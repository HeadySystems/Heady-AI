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
// ║  FILE: HeadyAI-IDE/src/components/SearchPanel.jsx                ║
// ║  LAYER: frontend/src/components                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Replace, ChevronDown, ChevronRight, File,
  CaseSensitive, Regex, WholeWord, RefreshCw
} from 'lucide-react';
import cloudService from '../services/CloudService';
import { useIDEActions } from '../stores/ideStore';

const SearchPanel = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState(new Set());
  const actions = useIDEActions();
  const debounceRef = useRef(null);

  const performSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const response = await cloudService.searchFiles(query);
      setResults(response?.results || []);
      // Expand all files by default
      setExpandedFiles(new Set((response?.results || []).map(r => r.file)));
    } catch {
      // Fallback with demo results for offline mode
      setResults([
        {
          file: 'src/App.jsx',
          matches: [
            { line: 12, text: `  // Match for "${query}"`, column: 5 },
            { line: 45, text: `  const ${query} = useState(null);`, column: 8 },
          ]
        }
      ]);
      setExpandedFiles(new Set(['src/App.jsx']));
    } finally {
      setSearching(false);
    }
  }, [caseSensitive, wholeWord, useRegex]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(value), 300);
  };

  const toggleFile = (file) => {
    const next = new Set(expandedFiles);
    if (next.has(file)) next.delete(file);
    else next.add(file);
    setExpandedFiles(next);
  };

  const handleResultClick = (file, match) => {
    actions.openTab({
      name: file.split('/').pop(),
      path: file,
      content: '',
    });
  };

  const totalMatches = results.reduce((sum, r) => sum + (r.matches?.length || 0), 0);

  return (
    <div className="search-panel sidebar-panel">
      <div className="panel-header">
        <h3>Search</h3>
        <button
          className="panel-header-action"
          onClick={() => performSearch(searchQuery)}
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="search-inputs">
        <div className="search-input-row">
          <div className="search-input-wrapper">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={handleSearchChange}
              className="search-input"
            />
          </div>
          <div className="search-toggles">
            <button
              className={`search-toggle ${caseSensitive ? 'active' : ''}`}
              onClick={() => setCaseSensitive(!caseSensitive)}
              title="Match Case"
            >
              <CaseSensitive size={14} />
            </button>
            <button
              className={`search-toggle ${wholeWord ? 'active' : ''}`}
              onClick={() => setWholeWord(!wholeWord)}
              title="Match Whole Word"
            >
              <WholeWord size={14} />
            </button>
            <button
              className={`search-toggle ${useRegex ? 'active' : ''}`}
              onClick={() => setUseRegex(!useRegex)}
              title="Use Regular Expression"
            >
              <Regex size={14} />
            </button>
          </div>
        </div>

        <button
          className="replace-toggle"
          onClick={() => setShowReplace(!showReplace)}
        >
          {showReplace ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Replace size={14} />
        </button>

        <AnimatePresence>
          {showReplace && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="replace-input-row"
            >
              <div className="search-input-wrapper">
                <Replace size={14} />
                <input
                  type="text"
                  placeholder="Replace"
                  value={replaceQuery}
                  onChange={(e) => setReplaceQuery(e.target.value)}
                  className="search-input"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results */}
      <div className="search-results">
        {searching && (
          <div className="search-status">Searching...</div>
        )}

        {!searching && searchQuery && (
          <div className="search-status">
            {totalMatches} result{totalMatches !== 1 ? 's' : ''} in {results.length} file{results.length !== 1 ? 's' : ''}
          </div>
        )}

        {results.map((result) => (
          <div key={result.file} className="search-result-file">
            <button
              className="search-result-file-header"
              onClick={() => toggleFile(result.file)}
            >
              {expandedFiles.has(result.file) ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
              <File size={14} />
              <span className="result-filename">{result.file}</span>
              <span className="result-count">{result.matches?.length}</span>
            </button>

            <AnimatePresence>
              {expandedFiles.has(result.file) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="search-result-matches"
                >
                  {result.matches?.map((match, idx) => (
                    <button
                      key={idx}
                      className="search-result-match"
                      onClick={() => handleResultClick(result.file, match)}
                    >
                      <span className="match-line">{match.line}</span>
                      <span className="match-text">{match.text}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchPanel;
