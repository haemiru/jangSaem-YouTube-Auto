/**
 * YouTube Upload Service
 * - Google Identity Services (GIS) OAuth 2.0 implicit flow
 * - YouTube Data API v3 resumable upload
 * - Custom thumbnail upload
 */

const SCOPES = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube';
const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';
const YT_UPLOAD_BASE = 'https://www.googleapis.com/upload/youtube/v3';

/**
 * Request OAuth 2.0 access token via Google Identity Services popup
 */
export function requestAccessToken(clientId) {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services가 로드되지 않았습니다. 페이지를 새로고침해주세요.'));
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(`OAuth 오류: ${response.error} - ${response.error_description || ''}`));
          return;
        }
        resolve(response.access_token);
      },
      error_callback: (err) => {
        reject(new Error(`OAuth 팝업 오류: ${err.type || '알 수 없는 오류'}`));
      },
    });

    tokenClient.requestAccessToken();
  });
}

/**
 * Verify token is still valid
 */
export async function verifyToken(accessToken) {
  const res = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`);
  if (!res.ok) return false;
  const data = await res.json();
  return data.expires_in > 60; // at least 1 minute remaining
}

/**
 * Fetch user's playlists
 */
export async function fetchPlaylists(accessToken) {
  const res = await fetch(`${YT_API_BASE}/playlists?part=snippet&mine=true&maxResults=50`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('재생목록 조회 실패');
  const data = await res.json();
  return data.items.map(item => ({
    id: item.id,
    title: item.snippet.title,
  }));
}

/**
 * Upload video using resumable upload protocol
 * @param {Object} params
 * @param {string} params.accessToken
 * @param {File} params.videoFile
 * @param {Object} params.metadata - { title, description, tags, privacy, playlistId, scheduledAt }
 * @param {function} params.onProgress - (percent, statusText) => void
 * @returns {Promise<string>} videoId
 */
export async function uploadVideo({ accessToken, videoFile, metadata, onProgress }) {
  onProgress(0, '업로드 세션 초기화 중...');

  const privacyStatus = metadata.scheduledAt ? 'private' : (metadata.privacy || 'private');

  const videoResource = {
    snippet: {
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
      categoryId: '22', // People & Blogs
      defaultLanguage: 'ko',
      defaultAudioLanguage: 'ko',
    },
    status: {
      privacyStatus,
      selfDeclaredMadeForKids: false,
      ...(metadata.scheduledAt && {
        privacyStatus: 'private',
        publishAt: new Date(metadata.scheduledAt).toISOString(),
      }),
    },
  };

  // Step 1: Initiate resumable upload session
  const initRes = await fetch(
    `${YT_UPLOAD_BASE}/videos?uploadType=resumable&part=snippet,status`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': videoFile.size,
        'X-Upload-Content-Type': videoFile.type,
      },
      body: JSON.stringify(videoResource),
    }
  );

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`업로드 세션 초기화 실패 (${initRes.status}): ${errText.substring(0, 200)}`);
  }

  const uploadUrl = initRes.headers.get('Location');
  if (!uploadUrl) throw new Error('업로드 URL을 받지 못했습니다');

  // Step 2: Upload the video file with progress tracking
  onProgress(5, '영상 파일 업로드 중...');

  const videoId = await uploadFileWithProgress(uploadUrl, videoFile, accessToken, (pct) => {
    // Map file upload progress to 5-80% of overall progress
    const overallPct = 5 + Math.round(pct * 0.75);
    onProgress(overallPct, `영상 파일 업로드 중... ${Math.round(pct)}%`);
  });

  onProgress(85, '메타데이터 처리 중...');

  // Step 3: Add to playlist if specified
  if (metadata.playlistId) {
    onProgress(90, '재생목록에 추가 중...');
    await addToPlaylist(accessToken, videoId, metadata.playlistId);
  }

  onProgress(100, '업로드 완료!');
  return videoId;
}

/**
 * Upload file with XMLHttpRequest for progress tracking
 */
function uploadFileWithProgress(uploadUrl, file, accessToken, onProgressPct) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgressPct((e.loaded / e.total) * 100);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response.id);
        } catch {
          reject(new Error('업로드 응답 파싱 실패'));
        }
      } else {
        reject(new Error(`업로드 실패 (${xhr.status}): ${xhr.responseText.substring(0, 200)}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('네트워크 오류로 업로드 실패')));
    xhr.addEventListener('abort', () => reject(new Error('업로드가 취소되었습니다')));

    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}

/**
 * Set custom thumbnail for a video
 */
export async function setThumbnail(accessToken, videoId, thumbnailDataUrl) {
  // Convert data URL to blob
  const res = await fetch(thumbnailDataUrl);
  const blob = await res.blob();

  const uploadRes = await fetch(
    `${YT_UPLOAD_BASE}/thumbnails/set?videoId=${videoId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': blob.type,
      },
      body: blob,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    console.error('Thumbnail upload failed:', errText);
    // Don't throw - thumbnail failure shouldn't block the flow
    return false;
  }
  return true;
}

/**
 * Add video to playlist
 */
async function addToPlaylist(accessToken, videoId, playlistId) {
  const res = await fetch(`${YT_API_BASE}/playlistItems?part=snippet`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      snippet: {
        playlistId,
        resourceId: { kind: 'youtube#video', videoId },
      },
    }),
  });

  if (!res.ok) {
    console.error('Failed to add to playlist:', await res.text());
  }
}
