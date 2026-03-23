import React, { useState, useEffect, createContext } from 'react';
import {
  Settings,
  ClipboardList,
  Search,
  FileText,
  Image as ImageIcon,
  Upload,
  BarChart2,
  CheckCircle2,
  PlaySquare,
} from 'lucide-react';
import './index.css';
import * as pdfjsLib from 'pdfjs-dist';
import SettingsModal from './components/SettingsModal';
import PlanPanel from './components/PlanPanel';
import BenchmarkPanel from './components/BenchmarkPanel';
import ScriptPanel from './components/ScriptPanel';
import MediaPanel from './components/MediaPanel';
import UploadPanel from './components/UploadPanel';
import DashboardPanel from './components/DashboardPanel';

// --- Constants ---
const TABS = [
  { id: 'plan', label: '기획', icon: ClipboardList },
  { id: 'benchmark', label: '벤치마킹', icon: Search },
  { id: 'script', label: '대본', icon: FileText },
  { id: 'media', label: '미디어', icon: ImageIcon },
  { id: 'upload', label: '업로드', icon: Upload },
  { id: 'dashboard', label: '대시보드', icon: BarChart2 },
];

// Setup PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const INIT_STATE = {
  settings: {
    // Google OAuth Client ID is public — stored in browser
    googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  },
  plan: { topic: '', format: '쇼츠 60초', targets: [], ebookName: '', ebookSummary: '', tone: '전문적', model: 'claude-opus-4-6' },
  benchmark: { channels: [], thumbnailPatterns: [], titleFormulas: [], tagPool: [] },
  script: { hook: '', bridge: '', sections: [], cta: '', titleSuggestions: [], thumbnailCopies: [] },
  media: { selectedThumbnailCopy: '', imagePrompts: [], generatedImages: [], selectedThumbnail: '' },
  metadata: { title: '', description: '', tags: [], hashtags: [], cotLog: '' },
  upload: { scheduleType: '', scheduledAt: '', visibility: '', uploadStatus: '' }
};

// --- Context ---
export const AppContext = createContext();

// Main App
export default function App() {
  const [globalState, setGlobalState] = useState(INIT_STATE);
  const [activeTab, setActiveTab] = useState('plan');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Load Google Client ID from localStorage on init
  useEffect(() => {
    const savedClientId = localStorage.getItem('googleClientId');
    if (savedClientId) {
      setGlobalState(prev => ({
        ...prev,
        settings: { ...prev.settings, googleClientId: savedClientId }
      }));
    }
  }, []);

  const updateState = (section, payload) => {
    setGlobalState(prev => ({
      ...prev,
      [section]: payload
    }));
  };

  // Determine if a tab is "completed" (basic logic for demo)
  const isTabCompleted = (tabId) => {
    if (tabId === 'plan' && globalState.plan.topic.length > 0) return true;
    if (tabId === 'benchmark' && globalState.benchmark.channels.length > 0) return true;
    if (tabId === 'script' && globalState.script.final_hook) return true;
    if (tabId === 'media' && globalState.media.timeline) return true;
    if (tabId === 'upload' && globalState.upload.videoId) return true;
    return false;
  };

  return (
    <AppContext.Provider value={{ globalState, updateState }}>
      <div className="app-container">

        {/* Header */}
        <header className="header">
          <div className="header-logo">
            <PlaySquare color="var(--primary)" size={28} />
            <span>JjangSaem YouTube Auto</span>
          </div>
          <button className="header-btn" onClick={() => setIsSettingsOpen(true)}>
            <Settings size={18} />
            설정
          </button>
        </header>

        {/* Main Workspace */}
        <main className="main-content">

          {/* Tabs Navigation */}
          <div className="tabs-container">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const completed = isTabCompleted(tab.id);
              return (
                <button
                  key={tab.id}
                  className={`tab-btn ${activeTab === tab.id ? 'active' : ''} ${completed ? 'completed' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className={`tab-icon ${completed ? 'completed' : ''}`}>
                    {completed ? <CheckCircle2 size={18} /> : <Icon size={18} />}
                  </span>
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* All Tab Panels - always mounted, hidden via CSS to preserve state */}
          <div style={{ display: activeTab === 'plan' ? 'block' : 'none' }}>
            <PlanPanel globalState={globalState} updateState={updateState} onNext={() => setActiveTab('benchmark')} />
          </div>
          <div style={{ display: activeTab === 'benchmark' ? 'block' : 'none' }}>
            <BenchmarkPanel globalState={globalState} updateState={updateState} onNext={() => setActiveTab('script')} />
          </div>
          <div style={{ display: activeTab === 'script' ? 'block' : 'none' }}>
            <ScriptPanel globalState={globalState} updateState={updateState} onNext={() => setActiveTab('media')} />
          </div>
          <div style={{ display: activeTab === 'media' ? 'block' : 'none' }}>
            <MediaPanel globalState={globalState} updateState={updateState} onNext={() => setActiveTab('upload')} />
          </div>
          <div style={{ display: activeTab === 'upload' ? 'block' : 'none' }}>
            <UploadPanel globalState={globalState} updateState={updateState} onNext={() => setActiveTab('dashboard')} />
          </div>
          <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
            <DashboardPanel globalState={globalState} onNavigate={setActiveTab} />
          </div>

        </main>

        {/* Settings Modal */}
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} globalState={globalState} updateState={updateState} />

      </div>
    </AppContext.Provider>
  );
}
