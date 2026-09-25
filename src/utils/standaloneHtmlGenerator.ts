/**
 * IWasHere Standalone HTML Generator (Zero-Network Offline Fallback)
 *
 * Compiles a self-contained single-file HTML application containing all inline CSS,
 * JavaScript, cryptographic functions, anti-tampering engine, camera capture,
 * and a robust multi-stage GPS location finder with live tracking and retry capabilities.
 *
 * Can be distributed via flash drive, Bluetooth, or SD card and executed directly
 * on mobile browsers using the file:// protocol with zero internet connection.
 */

import { Campaign } from '../types/attendance';

export function generateStandaloneHtml(
  campaign: Campaign,
  options?: {
    organizationName?: string;
    accentColor?: string;
  }
): string {
  const accentColor = options?.accentColor || '#00FF66';
  const orgName = options?.organizationName || 'NYSC CDS';
  const campaignJson = JSON.stringify(campaign);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>IWasHere Offline Attendance - ${campaign.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: #0a0c10; color: #f8fafc; min-height: 100vh; display: flex; flex-direction: column; padding: 14px; }
    .container { max-width: 500px; width: 100%; margin: 0 auto; flex: 1; display: flex; flex-direction: column; }
    .header { text-align: center; margin-bottom: 16px; padding: 12px 0 16px; border-bottom: 1px solid #1e2738; }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; background: rgba(0, 255, 102, 0.12); color: ${accentColor}; border: 1px solid rgba(0, 255, 102, 0.3); margin-bottom: 8px; }
    .title { font-size: 20px; font-weight: 900; letter-spacing: -0.02em; color: #ffffff; line-height: 1.25; }
    .subtitle { font-size: 12px; color: #94a3b8; margin-top: 5px; }
    
    .card { background: #111723; border: 1px solid #1e2738; border-radius: 18px; padding: 18px; margin-bottom: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .form-group { margin-bottom: 14px; }
    label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 6px; }
    input, select { width: 100%; background: #0b0e14; border: 1px solid #232d3f; border-radius: 10px; padding: 12px 14px; color: #ffffff; font-size: 14px; outline: none; transition: border-color 0.2s; }
    input:focus, select:focus { border-color: ${accentColor}; }
    
    /* Geolocation Finder Box */
    .geo-card { background: #0b0f17; border: 1px solid #1f2a3c; border-radius: 14px; padding: 14px; margin-bottom: 16px; }
    .geo-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex-wrap: wrap; gap: 8px; }
    .geo-title { font-size: 12px; font-weight: 800; color: #e2e8f0; display: flex; align-items: center; gap: 6px; text-transform: uppercase; letter-spacing: 0.05em; }
    .geo-status-tag { font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; font-family: monospace; }
    .tag-verifying { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    .tag-verified { background: rgba(0, 255, 102, 0.15); color: ${accentColor}; border: 1px solid rgba(0, 255, 102, 0.35); }
    .tag-outside { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35); }
    .tag-error { background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.4); }

    .geo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; font-size: 11px; }
    .geo-item { background: #131a26; border: 1px solid #1e2838; padding: 8px 10px; border-radius: 8px; }
    .geo-label { color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 2px; }
    .geo-data { font-family: monospace; font-size: 12px; font-weight: bold; color: #f1f5f9; word-break: break-all; }
    
    .geo-btn-row { display: flex; gap: 8px; align-items: center; }
    .btn-geo-refresh { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 14px; background: #162234; hover: background: #1c2c44; border: 1px solid #2a3a50; border-radius: 8px; color: #e2e8f0; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
    .btn-geo-refresh:hover { background: #1c2c44; border-color: ${accentColor}; color: #ffffff; }
    .btn-geo-refresh:disabled { opacity: 0.6; cursor: not-allowed; }

    .geo-alert { display: none; margin-top: 10px; padding: 10px 12px; border-radius: 8px; font-size: 11px; line-height: 1.45; text-align: left; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5; }
    .geo-alert.show { display: block; }
    .geo-tip { margin-top: 6px; font-size: 10px; color: #94a3b8; }
    
    /* Camera & File Section */
    .file-btn { position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 14px; background: #16202f; border: 2px dashed #2c3a50; border-radius: 12px; color: #e2e8f0; font-size: 13px; font-weight: 700; cursor: pointer; text-align: center; }
    .file-btn input[type="file"] { position: absolute; left: 0; top: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; }
    .preview-box { width: 100%; height: 190px; border-radius: 12px; overflow: hidden; margin-top: 10px; display: none; background: #000; border: 1px solid #2d3b52; position: relative; }
    .preview-box img { width: 100%; height: 100%; object-fit: cover; }
    
    .btn-submit { width: 100%; padding: 15px; background: ${accentColor}; color: #0a0c10; border: none; border-radius: 12px; font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer; transition: transform 0.1s, opacity 0.2s; box-shadow: 0 4px 15px rgba(0,255,102,0.3); }
    .btn-submit:active { transform: scale(0.98); }
    .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
    
    .success-view { display: none; text-align: center; }
    .alert-box { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); color: #fbbf24; padding: 14px; border-radius: 12px; font-size: 12px; line-height: 1.5; margin-bottom: 16px; text-align: left; }
    .footer { text-align: center; font-size: 11px; color: #64748b; margin-top: auto; padding: 16px 0; }
    
    /* Loading Spinner */
    .spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: #fff; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">
        <span>●</span>
        <span>Zero-Network Standalone Mode</span>
      </div>
      <h1 class="title">${campaign.name}</h1>
      <p class="subtitle">${orgName} • CDS Date: ${campaign.date}</p>
    </div>

    <div id="form-section">
      <div class="card">
        <!-- Enhanced GPS Location Finder Panel -->
        <div class="geo-card">
          <div class="geo-header">
            <div class="geo-title">
              <span>📍 Live GPS Location Finder</span>
            </div>
            <div id="geo-status-badge" class="geo-status-tag tag-verifying">
              <span id="geo-status-text">Acquiring GPS...</span>
            </div>
          </div>

          <div class="geo-grid">
            <div class="geo-item">
              <div class="geo-label">Venue Distance</div>
              <div id="geo-distance" class="geo-data">Calculating...</div>
            </div>
            <div class="geo-item">
              <div class="geo-label">Allowed Geofence</div>
              <div id="geo-allowed-radius" class="geo-data">${campaign.allowedRadius || 200}m limit</div>
            </div>
            <div class="geo-item" style="grid-column: span 2;">
              <div class="geo-label">Member Device Coordinates</div>
              <div id="geo-coords" class="geo-data" style="color: #94a3b8;">Waiting for GPS fix...</div>
            </div>
          </div>

          <div class="geo-btn-row">
            <button type="button" id="refresh-geo-btn" class="btn-geo-refresh">
              <span id="refresh-icon">🔄</span>
              <span id="refresh-btn-label">Refresh / Detect GPS</span>
            </button>
          </div>

          <div id="geo-error-box" class="geo-alert">
            <strong id="geo-error-title">GPS Notice:</strong>
            <p id="geo-error-msg">Attempting to locate member device...</p>
            <div class="geo-tip">
              <strong>Troubleshooting tips:</strong><br>
              • Ensure Location/GPS is toggled <strong>ON</strong> in your phone's quick settings.<br>
              • If prompted by your browser, tap <strong>"Allow"</strong> for location access.<br>
              • If indoors, move close to an open window or step outdoors for clear satellite reception.
            </div>
          </div>
        </div>

        <form id="attendance-form">
          <div class="form-group">
            <label for="name">Full Name</label>
            <input type="text" id="name" placeholder="e.g. John Doe" required autocomplete="name">
          </div>

          <div class="form-group">
            <label for="state-code">State Code / ID</label>
            <input type="text" id="state-code" placeholder="e.g. LA/23B/1234" required style="text-transform: uppercase;">
          </div>

          <div class="form-group">
            <label for="time-block">Time-Block Code</label>
            <input type="text" id="time-block" placeholder="e.g. X12" required style="text-transform: uppercase;">
          </div>

          <div class="form-group">
            <label>Facial Verification Capture</label>
            <div class="file-btn">
              <span>📷 Take Live Selfie (Front Camera)</span>
              <!-- capture="user" invokes front-facing camera on mobile even under file:// -->
              <input type="file" id="camera-input" accept="image/*" capture="user" required>
            </div>
            <div id="preview-box" class="preview-box">
              <img id="photo-preview" src="" alt="Selfie Preview">
            </div>
          </div>

          <button type="submit" id="submit-btn" class="btn-submit">Generate Encrypted .IWH Package</button>
        </form>
      </div>
    </div>

    <div id="success-section" class="success-view card">
      <div style="font-size: 40px; margin-bottom: 10px;">🔒</div>
      <h2 style="font-size: 18px; font-weight: 800; color: #fff; margin-bottom: 6px;">Encrypted .iwh Generated!</h2>
      <p style="font-size: 12px; color: #94a3b8; margin-bottom: 16px;">
        Your encrypted attendance clearance file has been generated and saved to your device.
      </p>

      <div class="alert-box">
        <strong>Coordinator Delivery Instructions:</strong><br>
        1. Check your browser Downloads folder for your <span id="downloaded-name" style="color: #fff; font-family: monospace;">.iwh</span> file.<br>
        2. Transfer the file to your CDS Coordinator via WhatsApp, Bluetooth, or Flash drive for verification.
      </div>

      <button id="reset-btn" class="btn-submit" style="background: #1e293b; color: #fff; border: 1px solid #334155;">Submit Another Record</button>
    </div>

    <div class="footer">
      IWasHere Military-Grade Cryptographic Roll Call • Standalone Edition
    </div>
  </div>

  <script>
    // Embedded Campaign Configuration
    const CAMPAIGN = ${campaignJson};
    const PASSPHRASE = 'IWasHere-Secure-Tenancy-AES256-Attendance-2026';

    const targetLat = typeof CAMPAIGN.targetLatitude === 'number' ? CAMPAIGN.targetLatitude : parseFloat(CAMPAIGN.targetLatitude || '0');
    const targetLng = typeof CAMPAIGN.targetLongitude === 'number' ? CAMPAIGN.targetLongitude : parseFloat(CAMPAIGN.targetLongitude || '0');
    const allowedRadius = typeof CAMPAIGN.allowedRadius === 'number' ? CAMPAIGN.allowedRadius : (parseFloat(CAMPAIGN.allowedRadius || '200') || 200);
    const hasTargetVenue = !isNaN(targetLat) && !isNaN(targetLng) && (targetLat !== 0 || targetLng !== 0);

    // 1. Client-Side Anti-Tampering Engine
    let initialWallTime = Date.now();
    let initialPerfTime = performance.now();
    let lastWallTime = initialWallTime;
    let isTampered = false;

    function checkAntiTamper() {
      const currentWall = Date.now();
      const currentPerf = performance.now();

      // Check backward time manipulation
      if (currentWall < lastWallTime - 2000) {
        isTampered = true;
      }

      // Check drift between hardware uptime and wall clock
      const elapsedPerf = currentPerf - initialPerfTime;
      const elapsedWall = currentWall - initialWallTime;
      if (Math.abs(elapsedWall - elapsedPerf) > 8000) {
        isTampered = true;
      }

      lastWallTime = currentWall;
    }

    setInterval(checkAntiTamper, 1000);
    document.addEventListener('visibilitychange', checkAntiTamper);
    window.addEventListener('focus', checkAntiTamper);

    // 2. Multi-Stage Location Finder Engine
    let userCoords = null;
    let userDistance = null;
    let userAccuracy = null;
    let watchId = null;
    let isLocating = false;

    const geoStatusBadge = document.getElementById('geo-status-badge');
    const geoStatusText = document.getElementById('geo-status-text');
    const geoCoordsEl = document.getElementById('geo-coords');
    const geoDistanceEl = document.getElementById('geo-distance');
    const geoErrorBox = document.getElementById('geo-error-box');
    const geoErrorTitle = document.getElementById('geo-error-title');
    const geoErrorMsg = document.getElementById('geo-error-msg');
    const refreshBtn = document.getElementById('refresh-geo-btn');
    const refreshBtnLabel = document.getElementById('refresh-btn-label');
    const refreshIcon = document.getElementById('refresh-icon');

    function calculateHaversine(lat1, lon1, lat2, lon2) {
      const R = 6371000;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return Math.round(R * c);
    }

    function updateGeoUI(status, message, distance, coords, accuracy) {
      geoStatusBadge.className = 'geo-status-tag ' + (
        status === 'verified' ? 'tag-verified' :
        status === 'outside' ? 'tag-outside' :
        status === 'error' ? 'tag-error' : 'tag-verifying'
      );
      geoStatusText.innerText = message;

      if (coords) {
        const accStr = accuracy ? ' (±' + Math.round(accuracy) + 'm)' : '';
        geoCoordsEl.innerText = coords.latitude.toFixed(6) + ', ' + coords.longitude.toFixed(6) + accStr;
        geoCoordsEl.style.color = '#00FF66';
      }

      if (typeof distance === 'number') {
        if (!hasTargetVenue) {
          geoDistanceEl.innerText = 'No Venue Set (Open)';
          geoDistanceEl.style.color = '#00FF66';
        } else {
          geoDistanceEl.innerText = distance + 'm from venue';
          geoDistanceEl.style.color = distance <= allowedRadius ? '#00FF66' : '#ef4444';
        }
      }
    }

    function handleLocationSuccess(pos) {
      isLocating = false;
      refreshBtn.disabled = false;
      refreshBtnLabel.innerText = 'Refresh / Detect GPS';
      refreshIcon.innerHTML = '🔄';

      userCoords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude
      };
      userAccuracy = pos.coords.accuracy || 10;

      if (hasTargetVenue) {
        userDistance = calculateHaversine(
          userCoords.latitude,
          userCoords.longitude,
          targetLat,
          targetLng
        );
      } else {
        userDistance = 0;
      }

      geoErrorBox.classList.remove('show');

      if (!hasTargetVenue || userDistance <= allowedRadius) {
        updateGeoUI('verified', 'Verified at Venue (' + userDistance + 'm)', userDistance, userCoords, userAccuracy);
      } else {
        updateGeoUI('outside', 'Outside Limit (' + userDistance + 'm > ' + allowedRadius + 'm)', userDistance, userCoords, userAccuracy);
      }
    }

    function handleLocationError(err, allowFallback = true) {
      if (allowFallback && err && (err.code === 3 || err.code === 2)) {
        // Fallback: try standard accuracy with cached network position
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            handleLocationSuccess,
            (fallbackErr) => finalizeLocationError(fallbackErr),
            { enableHighAccuracy: false, timeout: 12000, maximumAge: 10000 }
          );
          return;
        }
      }
      finalizeLocationError(err);
    }

    function finalizeLocationError(err) {
      isLocating = false;
      refreshBtn.disabled = false;
      refreshBtnLabel.innerText = 'Retry Location Acquisition';
      refreshIcon.innerHTML = '🔄';

      let title = 'GPS Acquisition Error';
      let msg = 'Unable to determine your GPS location from the device.';

      if (err) {
        switch (err.code) {
          case 1: // PERMISSION_DENIED
            title = 'Location Permission Denied';
            msg = 'GPS permission was blocked. Please tap your browser settings icon or lock icon in the address bar, allow Location access, and tap Retry.';
            break;
          case 2: // POSITION_UNAVAILABLE
            title = 'GPS Signal Unavailable';
            msg = 'Device location is turned off or satellite signal is weak. Please enable Location/GPS in your phone settings and tap Retry.';
            break;
          case 3: // TIMEOUT
            title = 'GPS Request Timed Out';
            msg = 'GPS satellite lock took longer than expected. Please step near an open area and tap Retry below.';
            break;
          default:
            msg = err.message || msg;
        }
      }

      updateGeoUI('error', title, null, null, null);
      geoErrorTitle.innerText = title;
      geoErrorMsg.innerText = msg;
      geoErrorBox.classList.add('show');
    }

    function startLocationFinder(isUserTriggered = false) {
      if (!navigator.geolocation) {
        updateGeoUI('error', 'Unsupported Browser', null, null, null);
        geoErrorTitle.innerText = 'Geolocation Not Supported';
        geoErrorMsg.innerText = 'Your browser does not support HTML5 Geolocation.';
        geoErrorBox.classList.add('show');
        return;
      }

      isLocating = true;
      refreshBtn.disabled = true;
      refreshBtnLabel.innerText = 'Acquiring GPS Fix...';
      refreshIcon.innerHTML = '<span class="spinner"></span>';
      updateGeoUI('verifying', 'Locating device...', null, userCoords, userAccuracy);

      // 1. Immediate primary request with high accuracy (15s timeout)
      navigator.geolocation.getCurrentPosition(
        handleLocationSuccess,
        (err) => handleLocationError(err, true),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );

      // 2. Establish continuous watch stream to refine accuracy automatically
      if (!watchId) {
        try {
          watchId = navigator.geolocation.watchPosition(
            handleLocationSuccess,
            () => {}, // silent fail for watch stream since getCurrentPosition handles UI errors
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 3000 }
          );
        } catch(e) {
          // ignore watch errors
        }
      }
    }

    // Attach click listener to refresh button
    refreshBtn.addEventListener('click', () => {
      startLocationFinder(true);
    });

    // Automatically trigger location acquisition on load
    startLocationFinder(false);

    // 3. Camera Capture & Image Compression
    let base64Image = '';
    const cameraInput = document.getElementById('camera-input');
    const previewBox = document.getElementById('preview-box');
    const photoPreview = document.getElementById('photo-preview');

    cameraInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 360;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          base64Image = canvas.toDataURL('image/jpeg', 0.72);
          photoPreview.src = base64Image;
          previewBox.style.display = 'block';
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

    // 4. Cryptography & .iwh Package Generator
    function arrayBufferToBase64(buffer) {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    }

    async function deriveKey(passphrase, salt) {
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']);
      return await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );
    }

    async function calculateChecksum(dataStr) {
      const enc = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(dataStr));
      return arrayBufferToBase64(hashBuffer);
    }

    async function encryptAndDownload(record) {
      checkAntiTamper();
      record.tampered = isTampered;

      const enc = new TextEncoder();
      const plainJson = JSON.stringify(record);
      const checksum = await calculateChecksum(plainJson);

      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveKey(PASSPHRASE, salt);

      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        enc.encode(plainJson)
      );

      const dateStr = record.timestamp.split('T')[0];
      const encryptedPackage = {
        format: 'IWH_ENCRYPTED_V1',
        salt: arrayBufferToBase64(salt.buffer),
        iv: arrayBufferToBase64(iv.buffer),
        ciphertext: arrayBufferToBase64(ciphertext),
        checksum: checksum,
        metadata: {
          stateCode: record.stateCode,
          date: dateStr,
          campaignId: record.campaignId,
          orgId: record.orgId || '',
        }
      };

      const cleanCode = record.stateCode.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = cleanCode + '-' + dateStr + '.iwh';

      const blob = new Blob([JSON.stringify(encryptedPackage, null, 2)], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return filename;
    }

    // 5. Form Submission Handler
    const form = document.getElementById('attendance-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!base64Image) {
        alert('Please capture your live selfie before submitting.');
        return;
      }

      if (!userCoords || typeof userCoords.latitude !== 'number' || typeof userCoords.longitude !== 'number') {
        alert('Live GPS coordinates from your device are required to verify attendance. Please tap "Refresh / Detect GPS" to acquire your location.');
        startLocationFinder(true);
        return;
      }

      if (hasTargetVenue && userDistance !== null && userDistance > allowedRadius) {
        alert('You are ' + userDistance + 'm away from the CDS venue. You must be within ' + allowedRadius + 'm to submit attendance. If you are already at the venue, tap "Refresh / Detect GPS" to update.');
        return;
      }

      const submitBtn = document.getElementById('submit-btn');
      submitBtn.disabled = true;
      submitBtn.innerText = 'Encrypting & Packaging...';

      const record = {
        name: document.getElementById('name').value.trim(),
        stateCode: document.getElementById('state-code').value.trim().toUpperCase(),
        timeBlockCode: document.getElementById('time-block').value.trim().toUpperCase(),
        campaignId: CAMPAIGN.id,
        orgId: CAMPAIGN.orgId || '',
        timestamp: new Date().toISOString(),
        latitude: userCoords.latitude,
        longitude: userCoords.longitude,
        distanceMeters: userDistance || 0,
        accuracy: userAccuracy || 10,
        base64Image: base64Image,
        version: '1.0',
        tampered: isTampered,
      };

      try {
        const filename = await encryptAndDownload(record);
        document.getElementById('downloaded-name').innerText = filename;
        document.getElementById('form-section').style.display = 'none';
        document.getElementById('success-section').style.display = 'block';
      } catch (err) {
        alert('Encryption error: ' + err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Generate Encrypted .IWH Package';
      }
    });

    document.getElementById('reset-btn').addEventListener('click', () => {
      form.reset();
      base64Image = '';
      previewBox.style.display = 'none';
      document.getElementById('form-section').style.display = 'block';
      document.getElementById('success-section').style.display = 'none';
      startLocationFinder(false);
    });
  </script>
</body>
</html>`;
}

/**
 * Triggers a browser download of the standalone attendance-capture.html file
 */
export function downloadStandaloneHtml(
  campaign: Campaign,
  options?: {
    organizationName?: string;
    accentColor?: string;
  }
): string {
  const htmlContent = generateStandaloneHtml(campaign, options);
  const cleanCampaignName = campaign.name.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `attendance-capture-${cleanCampaignName}-${campaign.date}.html`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return filename;
}

