import { useMemo, useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import {
  TrendingUp,
  Clock,
  Calendar,
  Activity,
  Layers,
  Info,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Attendee, Campaign } from '../../types/attendance';

interface DashboardWidgetProps {
  attendees: Attendee[];
  campaign: Campaign | null;
  accentColor?: string;
  onFilterByDate?: (dateStr: string) => void;
  selectedDate?: string;
}

type ViewMode = 'timeline' | 'daily' | 'hourly';

interface DataPoint {
  date: Date;
  count: number;
  cumulative: number;
  label: string;
  details?: {
    compliantCount: number;
    offlineCount: number;
    names: string[];
  };
}

export function DashboardWidget({
  attendees,
  campaign,
  accentColor = '#00FF66',
  onFilterByDate,
  selectedDate,
}: DashboardWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(600);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // ResizeObserver to ensure responsiveness
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Process data based on viewMode
  const chartData = useMemo<DataPoint[]>(() => {
    if (!attendees || attendees.length === 0) return [];

    // Sort ascending by timestamp
    const sorted = [...attendees]
      .filter((a) => a.timestamp && !isNaN(new Date(a.timestamp).getTime()))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (sorted.length === 0) return [];

    if (viewMode === 'timeline') {
      // Timeline of cumulative check-ins
      let runningTotal = 0;
      return sorted.map((att) => {
        runningTotal += 1;
        const d = new Date(att.timestamp);
        return {
          date: d,
          count: 1,
          cumulative: runningTotal,
          label: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          details: {
            compliantCount: att.distanceMeters <= (campaign?.allowedRadius || 100) ? 1 : 0,
            offlineCount: att.isOfflineSync ? 1 : 0,
            names: [att.name],
          },
        };
      });
    }

    if (viewMode === 'daily') {
      // Group by YYYY-MM-DD
      const groups = new Map<
        string,
        {
          dateObj: Date;
          count: number;
          compliant: number;
          offline: number;
          names: string[];
        }
      >();

      sorted.forEach((att) => {
        const d = new Date(att.timestamp);
        const dayKey = d.toISOString().split('T')[0];
        const existing = groups.get(dayKey);
        const isCompliant = att.distanceMeters <= (campaign?.allowedRadius || 100);
        const isOffline = Boolean(att.isOfflineSync);

        if (!existing) {
          // use start of day in local representation
          const dayDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          groups.set(dayKey, {
            dateObj: dayDate,
            count: 1,
            compliant: isCompliant ? 1 : 0,
            offline: isOffline ? 1 : 0,
            names: [att.name],
          });
        } else {
          existing.count += 1;
          if (isCompliant) existing.compliant += 1;
          if (isOffline) existing.offline += 1;
          if (existing.names.length < 5) existing.names.push(att.name);
        }
      });

      let cumulative = 0;
      const sortedKeys = Array.from(groups.keys()).sort();
      return sortedKeys.map((key) => {
        const item = groups.get(key)!;
        cumulative += item.count;
        return {
          date: item.dateObj,
          count: item.count,
          cumulative,
          label: item.dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }),
          details: {
            compliantCount: item.compliant,
            offlineCount: item.offline,
            names: item.names,
          },
        };
      });
    }

    // Hourly Distribution (0-23 hours)
    const hourCounts = new Array(24).fill(0).map((_, hour) => ({
      hour,
      count: 0,
      compliant: 0,
      offline: 0,
      names: [] as string[],
    }));

    sorted.forEach((att) => {
      const d = new Date(att.timestamp);
      const hour = d.getHours();
      hourCounts[hour].count += 1;
      if (att.distanceMeters <= (campaign?.allowedRadius || 100)) {
        hourCounts[hour].compliant += 1;
      }
      if (att.isOfflineSync) {
        hourCounts[hour].offline += 1;
      }
      if (hourCounts[hour].names.length < 4) {
        hourCounts[hour].names.push(att.name);
      }
    });

    // Reference today's date for hourly points
    const baseDate = new Date();
    let cumulative = 0;
    return hourCounts.map((h) => {
      cumulative += h.count;
      const d = new Date(baseDate);
      d.setHours(h.hour, 0, 0, 0);
      const hourStr = `${h.hour.toString().padStart(2, '0')}:00`;
      return {
        date: d,
        count: h.count,
        cumulative,
        label: hourStr,
        details: {
          compliantCount: h.compliant,
          offlineCount: h.offline,
          names: h.names,
        },
      };
    });
  }, [attendees, viewMode, campaign]);

  // Derived Summary KPIs
  const kpiData = useMemo(() => {
    if (!attendees || attendees.length === 0) {
      return {
        earliestCheckIn: '—',
        latestCheckIn: '—',
        peakHour: '—',
        peakRate: 0,
        avgPerDay: 0,
      };
    }

    const sorted = [...attendees]
      .filter((a) => a.timestamp && !isNaN(new Date(a.timestamp).getTime()))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (sorted.length === 0) {
      return {
        earliestCheckIn: '—',
        latestCheckIn: '—',
        peakHour: '—',
        peakRate: 0,
        avgPerDay: 0,
      };
    }

    const first = new Date(sorted[0].timestamp);
    const last = new Date(sorted[sorted.length - 1].timestamp);

    const earliestCheckIn = first.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const latestCheckIn = last.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Find peak hour
    const hourMap: Record<number, number> = {};
    sorted.forEach((a) => {
      const h = new Date(a.timestamp).getHours();
      hourMap[h] = (hourMap[h] || 0) + 1;
    });

    let peakH = 0;
    let maxCount = 0;
    Object.entries(hourMap).forEach(([hStr, cnt]) => {
      if (cnt > maxCount) {
        maxCount = cnt;
        peakH = parseInt(hStr, 10);
      }
    });

    const peakHour = maxCount > 0 ? `${peakH.toString().padStart(2, '0')}:00 - ${(peakH + 1).toString().padStart(2, '0')}:00` : '—';

    // Unique days
    const days = new Set(sorted.map((a) => a.timestamp.split('T')[0])).size;
    const avgPerDay = days > 0 ? (sorted.length / days).toFixed(1) : sorted.length;

    return {
      earliestCheckIn,
      latestCheckIn,
      peakHour,
      peakRate: maxCount,
      avgPerDay,
    };
  }, [attendees]);

  // Render D3 chart inside SVG
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    if (chartData.length === 0) return;

    const height = 240;
    const margin = { top: 20, right: 24, bottom: 32, left: 38 };
    const innerWidth = Math.max(containerWidth - margin.left - margin.right, 50);
    const innerHeight = height - margin.top - margin.bottom;

    // SVG root definitions: Gradients & clip paths
    const defs = svg.append('defs');

    // Gradient for the filled area under the curve
    const areaGradient = defs
      .append('linearGradient')
      .attr('id', 'attendanceAreaGrad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    areaGradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', accentColor)
      .attr('stop-opacity', 0.35);

    areaGradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', accentColor)
      .attr('stop-opacity', 0.0);

    // Glow filter for line and dots
    const filter = defs.append('filter').attr('id', 'glow').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    filter.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X Scale
    let xScale: d3.ScaleTime<number, number>;
    const xExtent = d3.extent(chartData, (d) => d.date) as [Date, Date];
    // If single point or same timestamps, add buffer
    if (xExtent[0].getTime() === xExtent[1].getTime()) {
      xScale = d3
        .scaleTime()
        .domain([new Date(xExtent[0].getTime() - 600000), new Date(xExtent[1].getTime() + 600000)])
        .range([0, innerWidth]);
    } else {
      xScale = d3.scaleTime().domain(xExtent).range([0, innerWidth]);
    }

    // Y Scale: chooses cumulative for timeline, count for daily/hourly
    const yValue = (d: DataPoint) => (viewMode === 'timeline' ? d.cumulative : d.count);
    const maxY = d3.max(chartData, yValue) || 1;
    const yScale = d3
      .scaleLinear()
      .domain([0, Math.max(maxY * 1.15, 4)])
      .nice()
      .range([innerHeight, 0]);

    // Horizontal Grid Lines
    const yTicks = yScale.ticks(4);
    g.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(yTicks)
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', '#1e293b')
      .attr('stroke-dasharray', '3 3')
      .attr('stroke-width', 1);

    // X Axis
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(Math.min(Math.floor(innerWidth / 70), 6))
      .tickSize(0)
      .tickPadding(10)
      .tickFormat((d) => {
        const date = d as Date;
        if (viewMode === 'daily') {
          return d3.timeFormat('%d %b')(date);
        }
        if (viewMode === 'hourly') {
          return d3.timeFormat('%H:%M')(date);
        }
        return d3.timeFormat('%H:%M')(date);
      });

    const xAxisG = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisG.select('.domain').attr('stroke', '#1e293b');
    xAxisG.selectAll('text').attr('fill', '#64748b').attr('font-size', '10px').attr('font-family', 'monospace');

    // Y Axis
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(4)
      .tickSize(0)
      .tickPadding(8)
      .tickFormat(d3.format('d'));

    const yAxisG = g.append('g').call(yAxis);
    yAxisG.select('.domain').remove();
    yAxisG.selectAll('text').attr('fill', '#64748b').attr('font-size', '10px').attr('font-family', 'monospace');

    // Area generator
    const areaGen = d3
      .area<DataPoint>()
      .curve(viewMode === 'hourly' ? d3.curveMonotoneX : d3.curveCatmullRom.alpha(0.5))
      .x((d) => xScale(d.date))
      .y0(innerHeight)
      .y1((d) => yScale(yValue(d)));

    // Line generator
    const lineGen = d3
      .line<DataPoint>()
      .curve(viewMode === 'hourly' ? d3.curveMonotoneX : d3.curveCatmullRom.alpha(0.5))
      .x((d) => xScale(d.date))
      .y((d) => yScale(yValue(d)));

    // Draw Area under curve
    g.append('path')
      .datum(chartData)
      .attr('fill', 'url(#attendanceAreaGrad)')
      .attr('d', areaGen);

    // Draw Main Line
    const path = g
      .append('path')
      .datum(chartData)
      .attr('fill', 'none')
      .attr('stroke', accentColor)
      .attr('stroke-width', 2.5)
      .attr('filter', 'url(#glow)')
      .attr('d', lineGen);

    // Add entrance animation to the path
    const totalLength = (path.node() as SVGPathElement)?.getTotalLength() || 0;
    path
      .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(750)
      .ease(d3.easeCubicOut)
      .attr('stroke-dashoffset', 0);

    // Interactive Overlay and Dots
    const dotsG = g.append('g').attr('class', 'chart-dots');

    dotsG
      .selectAll('circle')
      .data(chartData)
      .enter()
      .append('circle')
      .attr('cx', (d) => xScale(d.date))
      .attr('cy', (d) => yScale(yValue(d)))
      .attr('r', chartData.length > 25 ? 3 : 4.5)
      .attr('fill', '#0a0d14')
      .attr('stroke', accentColor)
      .attr('stroke-width', 2)
      .attr('cursor', 'pointer')
      .style('transition', 'transform 0.15s ease, r 0.15s ease')
      .on('mouseenter', function (event, d) {
        d3.select(this)
          .attr('r', 6.5)
          .attr('fill', accentColor);

        const [mouseX, mouseY] = d3.pointer(event, svgRef.current);
        setHoveredPoint(d);
        setTooltipPos({ x: mouseX, y: mouseY });
      })
      .on('mouseleave', function () {
        d3.select(this)
          .attr('r', chartData.length > 25 ? 3 : 4.5)
          .attr('fill', '#0a0d14');
        setHoveredPoint(null);
        setTooltipPos(null);
      })
      .on('click', (_, d) => {
        if (onFilterByDate && viewMode === 'daily') {
          const dateStr = d.date.toISOString().split('T')[0];
          onFilterByDate(dateStr);
        }
      });

    // Invisible Voronoi/Rect tracking overlay for smooth crosshair scrub
    const bisectDate = d3.bisector((d: DataPoint) => d.date).center;

    svg
      .append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('transform', `translate(${margin.left},${margin.top})`)
      .attr('fill', 'transparent')
      .attr('cursor', 'crosshair')
      .on('mousemove', function (event) {
        const [xPos] = d3.pointer(event, this);
        const x0 = xScale.invert(xPos);
        const idx = bisectDate(chartData, x0);
        const selected = chartData[Math.min(Math.max(idx, 0), chartData.length - 1)];

        if (selected) {
          const cx = xScale(selected.date) + margin.left;
          const cy = yScale(yValue(selected)) + margin.top;
          setHoveredPoint(selected);
          setTooltipPos({ x: cx, y: cy });
        }
      })
      .on('mouseleave', () => {
        setHoveredPoint(null);
        setTooltipPos(null);
      });
  }, [chartData, containerWidth, viewMode, accentColor, onFilterByDate]);

  return (
    <div
      id="dashboard-widget-trends"
      ref={containerRef}
      className="bg-[#0d121a] border border-[#1e2738] rounded-3xl p-4 sm:p-5 shadow-sm space-y-4 relative overflow-hidden"
    >
      {/* Decorative subtle ambient light */}
      <div
        className="absolute -top-16 -right-16 w-36 h-36 rounded-full blur-3xl opacity-10 pointer-events-none"
        style={{ backgroundColor: accentColor }}
      />

      {/* Header bar: Title, View Switcher & Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div className="flex items-center space-x-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold"
            style={{
              backgroundColor: `${accentColor}18`,
              color: accentColor,
              border: `1px solid ${accentColor}35`,
            }}
          >
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-extrabold text-white tracking-tight">
                Attendance Velocity & Trends
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                D3.js Realtime
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {viewMode === 'timeline' && 'Cumulative check-in timestamps stream over time'}
              {viewMode === 'daily' && 'Daily attendance volume & distribution'}
              {viewMode === 'hourly' && '24-hour diurnal check-in velocity curve'}
            </p>
          </div>
        </div>

        {/* View Mode Selector Tabs */}
        <div className="flex items-center space-x-1 bg-[#141b26] p-1 rounded-xl border border-[#232e40] self-start sm:self-auto">
          <button
            id="tab-view-timeline"
            type="button"
            onClick={() => setViewMode('timeline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              viewMode === 'timeline'
                ? 'bg-[#1e293b] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            style={{
              color: viewMode === 'timeline' ? accentColor : undefined,
            }}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Timeline</span>
          </button>

          <button
            id="tab-view-daily"
            type="button"
            onClick={() => setViewMode('daily')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              viewMode === 'daily'
                ? 'bg-[#1e293b] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            style={{
              color: viewMode === 'daily' ? accentColor : undefined,
            }}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Daily</span>
          </button>

          <button
            id="tab-view-hourly"
            type="button"
            onClick={() => setViewMode('hourly')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              viewMode === 'hourly'
                ? 'bg-[#1e293b] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            style={{
              color: viewMode === 'hourly' ? accentColor : undefined,
            }}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Hourly</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
        <div className="bg-[#121824] border border-[#202b3c] rounded-xl p-2.5 flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">First Scan</span>
            <span className="text-xs font-mono font-bold text-white truncate block">{kpiData.earliestCheckIn}</span>
          </div>
        </div>

        <div className="bg-[#121824] border border-[#202b3c] rounded-xl p-2.5 flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
            <Layers className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Peak Surge</span>
            <span className="text-xs font-mono font-bold text-white truncate block">{kpiData.peakHour}</span>
          </div>
        </div>

        <div className="bg-[#121824] border border-[#202b3c] rounded-xl p-2.5 flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Peak Volume</span>
            <span className="text-xs font-mono font-bold text-white truncate block">
              {kpiData.peakRate} <span className="text-[10px] font-normal text-slate-400">scans/hr</span>
            </span>
          </div>
        </div>

        <div className="bg-[#121824] border border-[#202b3c] rounded-xl p-2.5 flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Daily Avg</span>
            <span className="text-xs font-mono font-bold text-white truncate block">
              {kpiData.avgPerDay} <span className="text-[10px] font-normal text-slate-400">members</span>
            </span>
          </div>
        </div>
      </div>

      {/* D3 SVG Line Canvas */}
      <div className="relative w-full h-[240px] bg-[#0b0e14] rounded-2xl border border-[#1b2333] p-1 overflow-hidden">
        {chartData.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-6">
            <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mb-2">
              <Activity className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-300">No Check-in Timestamps Recorded</p>
            <p className="text-[11px] text-slate-500 max-w-xs mt-0.5">
              Once members scan in or upload offline sync packets, the D3 velocity curve will plot in real time.
            </p>
          </div>
        ) : (
          <>
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              className="overflow-visible select-none"
            />

            {/* Custom Interactive Tooltip */}
            {hoveredPoint && tooltipPos && (
              <div
                className="absolute pointer-events-none z-20 bg-[#141b27]/95 backdrop-blur border border-[#26354a] rounded-xl px-3 py-2 shadow-2xl text-left transition-all duration-75 text-xs space-y-1"
                style={{
                  left: `${Math.min(Math.max(tooltipPos.x + 12, 12), containerWidth - 190)}px`,
                  top: `${Math.min(Math.max(tooltipPos.y - 45, 10), 160)}px`,
                }}
              >
                <div className="flex items-center justify-between space-x-3 border-b border-[#212c3f] pb-1">
                  <span className="text-[10px] text-slate-400 font-mono flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{hoveredPoint.label}</span>
                  </span>
                  <span className="font-mono font-extrabold" style={{ color: accentColor }}>
                    {viewMode === 'timeline' ? `${hoveredPoint.cumulative} Total` : `${hoveredPoint.count} Scans`}
                  </span>
                </div>

                {hoveredPoint.details && (
                  <div className="space-y-0.5 pt-0.5 text-[10px]">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="flex items-center space-x-1 text-slate-400">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                        <span>In Geofence:</span>
                      </span>
                      <span className="font-bold text-slate-200">{hoveredPoint.details.compliantCount}</span>
                    </div>

                    {hoveredPoint.details.offlineCount > 0 && (
                      <div className="flex items-center justify-between text-amber-400">
                        <span className="flex items-center space-x-1 text-slate-400">
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                          <span>Offline Packets:</span>
                        </span>
                        <span className="font-bold text-amber-300">{hoveredPoint.details.offlineCount}</span>
                      </div>
                    )}

                    {hoveredPoint.details.names.length > 0 && (
                      <div className="pt-1 text-[9px] text-slate-400 truncate max-w-[160px]">
                        Recent: <span className="text-slate-200">{hoveredPoint.details.names.join(', ')}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Insight Note */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-0.5 text-[11px] text-slate-400 px-1">
        <div className="flex items-center space-x-1.5">
          <Info className="w-3.5 h-3.5 text-slate-500" />
          <span>
            {viewMode === 'daily'
              ? 'Click any point on the chart to filter the attendance list below by that date.'
              : 'Interactive curves compute real-time roll call throughput and verification velocity.'}
          </span>
        </div>
        {selectedDate && onFilterByDate && (
          <button
            type="button"
            onClick={() => onFilterByDate('')}
            className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer self-start sm:self-auto"
          >
            Reset Date Filter ({selectedDate})
          </button>
        )}
      </div>
    </div>
  );
}
