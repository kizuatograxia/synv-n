'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

export interface Tab {
  id: string;
  label: string;
  content?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  activeTab?: string;
  onChange?: (tabId: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, defaultTab, activeTab: controlledActiveTab, onChange, className }) => {
  const [internalActiveTab, setInternalActiveTab] = useState(defaultTab || tabs[0]?.id);
  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;
  const setActiveTab = onChange || setInternalActiveTab;
  const [focusedTab, setFocusedTab] = useState<string | null>(null);
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (focusedTab) {
      const index = tabs.findIndex((tab) => tab.id === focusedTab);
      tabsRef.current[index]?.focus();
    }
  }, [focusedTab, tabs]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, tabId: string) => {
    const index = tabs.findIndex((tab) => tab.id === tabId);

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        const prevIndex = index > 0 ? index - 1 : tabs.length - 1;
        setFocusedTab(tabs[prevIndex].id);
        break;
      case 'ArrowRight':
        event.preventDefault();
        const nextIndex = index < tabs.length - 1 ? index + 1 : 0;
        setFocusedTab(tabs[nextIndex].id);
        break;
      case 'Home':
        event.preventDefault();
        setFocusedTab(tabs[0].id);
        break;
      case 'End':
        event.preventDefault();
        setFocusedTab(tabs[tabs.length - 1].id);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!tabs[index].disabled) {
          setActiveTab(tabId);
        }
        break;
    }
  };

  return (
    <div className={cn(className)}>
      <div role="tablist" aria-orientation="horizontal" className="inline-flex bg-neutral-100 rounded-xl p-1 gap-1">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(el) => { tabsRef.current[index] = el }}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && setActiveTab(tab.id)}
            onFocus={() => setFocusedTab(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, tab.id)}
            className={cn(
              'px-4 py-2 font-medium text-sm rounded-lg transition-all duration-200',
              tab.disabled
                ? 'text-neutral-300 cursor-not-allowed'
                : activeTab === tab.id
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          tabIndex={0}
          hidden={activeTab !== tab.id}
          className="py-4"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
};
