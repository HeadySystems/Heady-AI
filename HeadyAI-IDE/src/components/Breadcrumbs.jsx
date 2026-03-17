// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: HeadyAI-IDE/src/components/Breadcrumbs.jsx                ║
// ║  LAYER: frontend/src/components                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

import React from 'react';
import { ChevronRight, Folder, File } from 'lucide-react';
import { useIDE } from '../stores/ideStore';

const Breadcrumbs = () => {
  const { state } = useIDE();
  const activeTab = state.openTabs.find(t => t.id === state.activeTabId);

  if (!activeTab) return null;

  const pathParts = (activeTab.path || activeTab.name).split('/').filter(Boolean);

  return (
    <div className="breadcrumbs">
      {pathParts.map((part, index) => {
        const isLast = index === pathParts.length - 1;
        return (
          <React.Fragment key={index}>
            <button className={`breadcrumb-item ${isLast ? 'current' : ''}`}>
              {isLast ? <File size={12} /> : <Folder size={12} />}
              <span>{part}</span>
            </button>
            {!isLast && <ChevronRight size={12} className="breadcrumb-separator" />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default Breadcrumbs;
