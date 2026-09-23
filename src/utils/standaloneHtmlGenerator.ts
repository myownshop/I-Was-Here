/**
 * IWasHere Standalone HTML Generator (Zero-Network Offline Fallback)
 *
 * Compiles a self-contained single-file HTML application containing all inline CSS,
 * JavaScript, cryptographic functions, anti-tampering engine, and camera capture.
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
    body { background-color: #0a0c10; color: #f8fafc; min-height: 100vh; display: flex; flex-direction: column; padding: 16px; }
    .container { max-width: 480px; width: 100%; margin: 0 auto; flex: 1; display: flex; flex-direction: column; }
    .header { text-align: center; margin-bottom: 20px; padding: 12px 0; border-bottom: 1px solid #1e2738; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; background: rgba(0, 255, 102, 0.12); color: ${accentColor}; border: 1px solid rgba(0, 255, 102, 0.3); margin-bottom: 8px; }
    .title { font-size: 20px; font-weight: 900; letter-spacing: -0.02em; color: #ffffff; }
    .subtitle { font-size: 12px; color: #94a3b8; margin-top: 4px; }
    .card { background: #111723; border: 1px solid #1e2738; border-radius: 16px; padding: 18px; margin-bottom: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .form-group { margin-bottom: 14px; }
    label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 6px; }
    input, select { width: 100%; background: #0b0e14; border: 1px solid #232d3f; border-radius: 10px; padding: 12px 14px; color: #ffffff; font-size: 14px; outline: none; transition: border-color 0.2s; }
    input:focus, select:focus { border-color: ${accentColor}; }
    .file-btn { position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 14px; background: #16202f; border: 2px dashed #2c3a50; border-radius: 12px; color: #e2e8f0; font-size: 13px; font-weight: 700; cursor: pointer; text-align: center; }
    .file-btn input[type="file"] { position: absolute; left: 0; top: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; }
    .preview-box { width: 100%; height: 180px; border-radius: 12px; overflow: hidden; margin-top: 10px; display: none; background: #000; border: 1px solid #2d3b52; position: relative; }
    .preview-box img { width: 100%; height: 100%; object-fit: cover; }
    .geo-pill { display: flex; align-items: center; justify-content: space-between; background: #0b0e14; border: 1px solid #1e2738; padding: 10px 12px; border-radius: 10px; font-size: 12px; margin-bottom: 14px; }
    .geo-val { font-family: monospace; font-weight: bold; color: ${accentColor}; }
    .btn-submit { width: 100%; padding: 15px; background: ${accentColor}; color: #0a0c10; border: none; border-radius: 12px; font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer; transition: transform 0.1s, opacity 0.2s; box-shadow: 0 4px 15px rgba(0,255,102,0.3); }
    .btn-submit:active { transform: scale(0.98); }
    .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
    .success-view { display: none; text-align: center; }
    .alert-box { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); color: #fbbf24; padding: 12px; border-radius: 10px; font-size: 11px; line-height: 1.5; margin-bottom: 16px; text-align: left; }
    .footer { text-align: center; font-size: 11px; color: #64748b; margin-top: auto; padding: 16px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">Zero-Network Standalone Mode</div>
      <h1 class="title">${campaign.name}</h1>
      <p class="subtitle">${orgName} • Date: ${campaign.date}</p>
    </div>

    <div id="form-section">
      <div class="card">
        <div class="geo-pill">
          <span>GPS Geofence Status:</span>
          <span id="geo-status" class="geo-val">Acquiring GPS...</span>
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

          <button type="submit" id="submit-btn" class="btn-submit">Generate .IWH Package</button>
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

    // 2. Geolocation Engine (Strictly from Member Device)
    let userCoords = null;
    let userDistance = null;

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

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          userCoords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          };
          userDistance = calculateHaversine(
            userCoords.latitude,
            userCoords.longitude,
            CAMPAIGN.targetLatitude,
            CAMPAIGN.targetLongitude
          );
          const statusEl = document.getElementById('geo-status');
          statusEl.innerText = userDistance + 'm from venue (' + (userDistance <= CAMPAIGN.allowedRadius ? 'Verified' : 'Outside') + ')';
          statusEl.style.color = userDistance <= CAMPAIGN.allowedRadius ? '${accentColor}' : '#ef4444';
        },
        (err) => {
          const statusEl = document.getElementById('geo-status');
          statusEl.innerText = 'GPS location permission required from member';
          statusEl.style.color = '#ef4444';
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      const statusEl = document.getElementById('geo-status');
      statusEl.innerText = 'Geolocation not supported on this browser';
      statusEl.style.color = '#ef4444';
    }

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
        alert('Please capture your front-camera selfie before submitting.');
        return;
      }

      if (!userCoords || typeof userCoords.latitude !== 'number' || typeof userCoords.longitude !== 'number') {
        alert('Your live GPS location is required to verify attendance. Please enable location permissions on your device.');
        return;
      }

      if (userDistance === null || userDistance > CAMPAIGN.allowedRadius) {
        const distMsg = userDistance !== null ? userDistance + 'm' : 'unknown distance';
        alert('You are ' + distMsg + ' away from the CDS venue. You must be within ' + CAMPAIGN.allowedRadius + 'm to submit attendance.');
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
        distanceMeters: userDistance,
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
        submitBtn.innerText = 'Generate .IWH Package';
      }
    });

    document.getElementById('reset-btn').addEventListener('click', () => {
      form.reset();
      base64Image = '';
      previewBox.style.display = 'none';
      document.getElementById('form-section').style.display = 'block';
      document.getElementById('success-section').style.display = 'none';
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
