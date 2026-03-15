import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { analyzeMessageStream, ApiError } from '../utils/llmHelper';
import { getRecommendedAction, getAvailableCategories, shouldEscalate, getAgentInfo } from '../utils/templates';

/**
 * AnalyzePage — customer message triage
 *
 * Fixes from original:
 *  - Textarea never locks. Users can edit and re-run without being forced to
 *    save a bad result first.
 *  - "Edit & re-run" button replaces the locked state entirely.
 *  - Uses analyzeMessageStream() — reasoning streams in token-by-token.
 *  - API errors shown in a dismissible inline banner — no silent mock fallback.
 *  - Confidence score with a color-coded bar; low-confidence results flagged.
 *  - Routing card shows assigned agent, role, and routing rationale.
 *  - Copy uses inline toast state — no window.alert().
 *  - "Analyze another message" after save replaces the awkward clear-then-restart flow.
 */

const CATEGORIES = getAvailableCategories();
const URGENCIES = ['Critical', 'High', 'Medium', 'Low'];

const QUICK_ACTIONS = [
  {
    label: 'Request screenshots',
    text: 'Could you please provide screenshots of the issue to help us investigate further?',
  },
  {
    label: 'Escalate to Tier 2',
    text: 'I am escalating this ticket to our Tier 2 support team for deeper investigation.',
  },
  {
    label: 'Schedule call',
    text: 'Would you be available for a quick 15-minute call to troubleshoot this live?',
  },
];

const URGENCY_STYLES = {
  Critical: 'bg-red-100 text-red-800 border border-red-200',
  High: 'bg-orange-100 text-orange-800 border border-orange-200',
  Medium: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  Low: 'bg-green-100 text-green-800 border border-green-200',
};

const confidenceBarColor = (n) => {
  if (n >= 80) return 'bg-green-500';
  if (n >= 55) return 'bg-yellow-500';
  return 'bg-red-400';
};

function AnalyzePage() {
  const [message, setMessage] = useState('');
  const [results, setResults] = useState(null);
  const [streamingText, setStreamingText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [copyToast, setCopyToast] = useState(false);
  const [originalCategory, setOriginalCategory] = useState(null);
  const [originalUrgency, setOriginalUrgency] = useState(null);
  const copyTimer = useRef(null);

  useEffect(() => {
    const example = localStorage.getItem('exampleMessage');
    if (example) {
      setMessage(example);
      localStorage.removeItem('exampleMessage');
    }
  }, []);

  const handleAnalyze = async () => {
    if (!message.trim()) return;

    setIsLoading(true);
    setResults(null);
    setStreamingText('');
    setApiError(null);
    setIsSaved(false);
    setOriginalCategory(null);
    setOriginalUrgency(null);

    try {
      const result = await analyzeMessageStream(message, (partial) => {
        setStreamingText(partial);
      });

      const action =
        result.recommended_action ||
        getRecommendedAction(result.category, result.urgency);

      const full = {
        ...result,
        recommended_action: action,
        message,
        timestamp: new Date().toISOString(),
      };

      setResults(full);
      setOriginalCategory(full.category);
      setOriginalUrgency(full.urgency);
      setStreamingText('');
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : `Unexpected error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setMessage('');
    setResults(null);
    setStreamingText('');
    setApiError(null);
    setIsSaved(false);
    setOriginalCategory(null);
    setOriginalUrgency(null);
  };

  const handleCategoryChange = (val) => {
    setResults((prev) => ({
      ...prev,
      category: val,
      recommended_action: getRecommendedAction(val, prev.urgency),
    }));
  };

  const handleUrgencyChange = (val) => {
    setResults((prev) => ({ ...prev, urgency: val }));
  };

  const handleActionChange = (val) => {
    setResults((prev) => ({ ...prev, recommended_action: val }));
  };

  const appendQuickAction = (text) => {
    setResults((prev) => ({
      ...prev,
      recommended_action: prev.recommended_action
        ? prev.recommended_action + '\n\n' + text
        : text,
    }));
  };

  const handleSave = () => {
    const history = JSON.parse(localStorage.getItem('triageHistory') || '[]');
    history.push({ ...results, timestamp: new Date().toISOString() });
    localStorage.setItem('triageHistory', JSON.stringify(history));
    setIsSaved(true);
  };

  const handleCopy = () => {
    if (!results) return;
    const text = [
      `Category: ${results.category}`,
      `Urgency: ${results.urgency} — ${results.urgency_reason || ''}`,
      `Confidence: ${results.confidence ?? '?'}%`,
      `Route to: ${results.route_to}`,
      `Action: ${results.recommended_action}`,
      `\nReasoning: ${results.reasoning}`,
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopyToast(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyToast(false), 2000);
  };

  const agent = results ? getAgentInfo(results.route_to) : null;
  const escalate = results ? shouldEscalate(results.category, results.urgency) : false;

  const categoryOptions = () => {
    const all = new Set([...CATEGORIES, originalCategory, results?.category].filter(Boolean));
    return Array.from(all);
  };

  const urgencyOptions = () => {
    const all = new Set([...URGENCIES, originalUrgency, results?.urgency].filter(Boolean));
    return Array.from(all);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-6">

        {/* ── Input card ── */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Analyze customer message</h1>
          <p className="text-gray-500 text-sm mb-5">
            Paste a message to categorize, score urgency, and route it to the right team.
          </p>

          {/* API error banner */}
          {apiError && (
            <div className="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 text-sm">
              <span className="text-base leading-none mt-0.5">⚠️</span>
              <div className="flex-1">
                <span className="font-semibold">API error — </span>
                {apiError}
              </div>
              <button
                onClick={() => setApiError(null)}
                className="text-red-400 hover:text-red-700 text-xl leading-none font-bold"
              >
                ×
              </button>
            </div>
          )}

          {/* Escalation alert */}
          {escalate && (
            <div className="mb-4 flex items-center gap-3 bg-red-50 border border-red-300 text-red-800 rounded-lg p-4 text-sm font-semibold">
              🚨 Escalation recommended — {results.urgency} urgency {results.category}
            </div>
          )}

          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Customer message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Paste customer message here…"
            className="w-full border border-gray-300 rounded-lg p-3 h-40 resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
            disabled={isLoading}
          />
          <div className="text-xs text-gray-400 mt-1 mb-4">{message.length} characters</div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleAnalyze}
              disabled={isLoading || !message.trim()}
              className="flex-1 min-w-[140px] py-3 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing…
                </span>
              ) : results ? 'Re-analyze' : 'Analyze message'}
            </button>
            {results && !isLoading && (
              <button
                onClick={handleClear}
                className="px-5 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
              >
                Clear
              </button>
            )}
            {!results && !isLoading && message && (
              <button
                onClick={handleClear}
                className="px-5 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Streaming indicator ── */}
        {isLoading && streamingText && (
          <div className="bg-white rounded-lg shadow-md p-5">
            <div className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              Reading response…
            </div>
            <div className="text-xs font-mono text-gray-400 bg-gray-50 rounded p-3 max-h-24 overflow-hidden leading-relaxed">
              {streamingText.slice(-400)}
            </div>
          </div>
        )}

        {/* ── Results card ── */}
        {results && !isLoading && (
          <div
            className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${
              isSaved ? 'border-green-500' : 'border-blue-500'
            }`}
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {isSaved ? 'Saved to history' : 'Review & confirm triage'}
                </h2>
                {!isSaved && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    Correct any fields below, then save.
                  </p>
                )}
              </div>
              {isSaved && (
                <span className="bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wide">
                  Saved
                </span>
              )}
            </div>

            <div className="space-y-5">

              {/* Category + Urgency */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-600 mb-1 flex justify-between">
                    <span>Category</span>
                    {results.category === originalCategory && (
                      <span className="text-blue-500 text-xs font-semibold">✨ AI suggestion</span>
                    )}
                  </div>
                  {isSaved ? (
                    <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-semibold">
                      {results.category}
                    </div>
                  ) : (
                    <select
                      value={results.category}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="w-full border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white"
                    >
                      {categoryOptions().map((c) => (
                        <option key={c} value={c}>
                          {c}{c === originalCategory ? ' ✨' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <div className="text-sm font-semibold text-gray-600 mb-1 flex justify-between">
                    <span>Urgency</span>
                    {results.urgency === originalUrgency && (
                      <span className="text-blue-500 text-xs font-semibold">✨ AI suggestion</span>
                    )}
                  </div>
                  {isSaved ? (
                    <div
                      className={`px-4 py-2 rounded-lg font-semibold ${
                        URGENCY_STYLES[results.urgency] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {results.urgency}
                    </div>
                  ) : (
                    <select
                      value={results.urgency}
                      onChange={(e) => handleUrgencyChange(e.target.value)}
                      className="w-full border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white"
                    >
                      {urgencyOptions().map((u) => (
                        <option key={u} value={u}>
                          {u}{u === originalUrgency ? ' ✨' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {results.urgency_reason && (
                    <p className="text-xs text-gray-500 mt-1">{results.urgency_reason}</p>
                  )}
                </div>
              </div>

              {/* Confidence bar */}
              {results.confidence !== undefined && (
                <div>
                  <div className="flex justify-between items-center text-sm mb-1">
                    <span className="font-semibold text-gray-600">AI confidence</span>
                    <span
                      className={`font-semibold ${
                        results.confidence >= 80
                          ? 'text-green-700'
                          : results.confidence >= 55
                          ? 'text-yellow-700'
                          : 'text-red-600'
                      }`}
                    >
                      {results.confidence}%
                      {results.confidence < 55 && (
                        <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                          Review carefully
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${confidenceBarColor(results.confidence)}`}
                      style={{ width: `${results.confidence}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Routing card */}
              {agent && (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="text-sm font-semibold text-gray-600 mb-3">Route to</div>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                      {agent.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm">{agent.name}</div>
                      <div className="text-xs text-gray-500">{agent.role}</div>
                      {results.routing_reason && (
                        <div className="text-xs text-gray-500 mt-1 italic">
                          {results.routing_reason}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Recommended action */}
              <div>
                <div className="flex justify-between items-end mb-1">
                  <span className="text-sm font-semibold text-gray-600">Recommended action</span>
                  {!isSaved && <span className="text-xs text-blue-500">Editable</span>}
                </div>
                {isSaved ? (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-gray-800 text-sm whitespace-pre-wrap">
                    {results.recommended_action}
                  </div>
                ) : (
                  <div>
                    <textarea
                      value={results.recommended_action}
                      onChange={(e) => handleActionChange(e.target.value)}
                      className="w-full border border-purple-200 bg-purple-50 rounded-lg p-4 text-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 min-h-[90px] text-sm resize-y"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="text-xs text-gray-400 py-1">Quick add:</span>
                      {QUICK_ACTIONS.map((a, i) => (
                        <button
                          key={i}
                          onClick={() => appendQuickAction(a.text)}
                          className="text-xs bg-white border border-gray-300 text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                        >
                          + {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* AI reasoning */}
              <div>
                <div className="text-sm font-semibold text-gray-600 mb-1">AI reasoning</div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="prose prose-sm max-w-none text-gray-700">
                    <ReactMarkdown>{results.reasoning}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-gray-200 flex flex-wrap gap-3">
              {!isSaved ? (
                <button
                  onClick={handleSave}
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-semibold transition-colors"
                >
                  ✓ Confirm &amp; save to history
                </button>
              ) : (
                <button
                  onClick={handleClear}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold transition-colors"
                >
                  Analyze another message
                </button>
              )}
              <button
                onClick={handleCopy}
                className="px-5 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors min-w-[140px]"
              >
                {copyToast ? '✓ Copied!' : '📋 Copy results'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AnalyzePage;
