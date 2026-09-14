import { escapeHtml, formatDate } from './htmls.js';

export function renderProfileHtml(user) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(user.full_name ?? 'Profile')}</title>
  <style>
   body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #ffffff 0%, #f8e9c2 40%, #d4af37 75%, #a8842c 100%);
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
      .card {
      width: 320px;
      border-radius: 30px;
      padding: 32px;
      background: #fff;
      box-shadow: 15px 15px 30px  rgba(0,0,0,0.08),
      -15px -15px 30px #ffffff;
      text-align: center;
    }
   
    .avatar {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      object-fit: cover;
      margin-bottom: 16px;
      border: 3px solid #eee;
    }
    .name { font-size: 20px; font-weight: 600; margin: 0 0 4px; }
    .email { color: #666; font-size: 14px; margin-bottom: 20px; }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #eee;
      font-size: 14px;
    }
    .info-row:last-child { border-bottom: none; }
    .label { color: #888; }
    .value { font-weight: 500; color: #222; }
  </style>
</head>
<body>
  <div class="card">
    ${user.avatar_url ? `<img class="avatar" src="${escapeHtml(user.avatar_url)}" alt="Avatar">` : ''}
    <div class="name">${escapeHtml(user.full_name ?? '')}</div>
    <div class="email">${escapeHtml(user.email ?? '')}</div>
    <div class="info-row">
      <span class="label">Phone</span>
      <span class="value">${escapeHtml(user.phone_number ?? '—')}</span>
    </div>
    <div class="info-row">
      <span class="label">Member since</span>
      <span class="value">${escapeHtml(formatDate(user.created_at))}</span>
    </div>
  </div>
</body>
</html>`;
}
