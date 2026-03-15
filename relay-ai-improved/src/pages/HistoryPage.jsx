import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

/**
 * HistoryPage
 *
 * Fixes from original:
 *  - Sort is now newest-first by timestamp (was: alphabetical by message text — a bug).
 *  - Per-item delete button — original only had "Clear All".
 *  - "Re-analyze" per item: writes message back to localStorage and navigates to /analyze.
 *  - Urgency badge styles updated to match new 4-level scale: Critical/High/Medium/Low.
 *  - Filter buttons count correctly after per-item deletion.
 */

const URGENCY_STYLES = {
  Critical: 'bg-red-100 text-red-800',
  High: 'bg-orange-100 text-orange-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Low: 'bg-green-100 text-green-800',
};

function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [filter, setFilter] = useState('all');
  const [expandedIndex, setExpandedIndex] = useState(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    const saved = JSON.parse(localStorage.getItem('triageHistory') || '[]');
    setHistory(saved);
  };

  const clearAll = () => {
    if (window.confirm('Clear all history? This cannot be undone.')) {
      localStorage.setItem('triageHistory', '[]');
      setHistory([]);
      setExpandedIndex(null);
    }
  };

  const deleteItem = (indexInFiltered) => {
    // Map filtered index back to the full history index via timestamp match
    const target = filteredHistory[indexInFiltered];
    const newHistory = history.filter(
      (item) => !(item.timestamp === target.timestamp && item.message === target.message)
    );
    localStorage.setItem('triageHistory', JSON.stringify(newHistory));
    setHistory(newHistory);
    setExpandedIndex(null);
  };

  const reanalyze = (item) => {
    localStorage.setItem('exampleMessage', item.message);
    window.location.href = '/analyze';
  };

  // Fix: sort by timestamp descending (newest first)
  // Original sorted by message text alphabetically — completely wrong
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  const categories = [...new Set(history.map((item) => item.category))];

  const filteredHistory =
    filter === 'all'
      ? sortedHistory
      : sortedHistory.filter((item) => item.category === filter);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analysis history</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {history.length} message{history.length !== 1 ? 's' : ''} triaged
              </p>
            </div>
            {history.length > 0 && (
              <button
                onClick={clearAll}
                className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg hover:bg-red-100 font-semibold text-sm transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {history.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg font-semibold text-sm ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({history.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm ${
                    filter === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat} ({history.filter((h) => h.category === cat).length})
                </button>
              ))}
            </div>
          )}
        </div>

        {filteredHistory.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-5xl mb-4">📭</div>
            <div className="text-xl text-gray-600 mb-2">No history yet</div>
            <p className="text-gray-500 mb-6">Analyzed messages will appear here</p>
            <a
              href="/analyze"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold"
            >
              Analyze a message
            </a>
          </div>
        )}

        <div className="space-y-4">
          {filteredHistory.map((item, index) => (
            <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden">
              {/* Row header — click to expand */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() =>
                  setExpandedIndex(expandedIndex === index ? null : index)
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-400 mb-1">
                      {new Date(item.timestamp).toLocaleString()}
                    </div>
                    <div className="text-gray-800 font-medium mb-2 truncate">
                      "{item.message.substring(0, 100)}{item.message.length > 100 ? '…' : ''}"
                    </div>
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold">
                        {item.category}
                      </span>
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-semibold ${
                          URGENCY_STYLES[item.urgency] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {item.urgency} urgency
                      </span>
                      {item.confidence !== undefined && (
                        <span className="text-xs text-gray-400">
                          {item.confidence}% confident
                        </span>
                      )}
                      {item.route_to && (
                        <span className="text-xs text-gray-500">
                          → {item.route_to}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-gray-400 text-sm flex-shrink-0">
                    {expandedIndex === index ? '▲' : '▼'}
                  </div>
                </div>
              </div>

              {/* Expanded detail */}
              {expandedIndex === index && (
                <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Full message
                    </div>
                    <div className="text-sm text-gray-800 bg-white p-3 rounded border border-gray-200">
                      {item.message}
                    </div>
                  </div>

                  {item.routing_reason && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Routing rationale
                      </div>
                      <div className="text-sm text-gray-700 bg-white p-3 rounded border border-gray-200 italic">
                        {item.routing_reason}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Recommended action
                    </div>
                    <div className="text-sm text-gray-800 bg-purple-50 p-3 rounded border border-purple-200 whitespace-pre-wrap">
                      {item.recommended_action}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      AI reasoning
                    </div>
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <div className="prose prose-sm max-w-none text-gray-700">
                        <ReactMarkdown>{item.reasoning}</ReactMarkdown>
                      </div>
                    </div>
                  </div>

                  {/* Per-item actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => reanalyze(item)}
                      className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold transition-colors"
                    >
                      Re-analyze
                    </button>
                    <button
                      onClick={() => deleteItem(index)}
                      className="text-sm bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 font-semibold transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default HistoryPage;
