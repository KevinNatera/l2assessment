import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

/**
 * HomePage
 *
 * Fixes from original:
 *  - "Try Example" uses React Router navigate() instead of window.location.href,
 *    avoiding a full page reload that discards React state.
 *  - Recent activity urgency badge colors match the 4-level scale: Critical/High/Medium/Low.
 *  - Confidence shown in recent activity if available.
 */

const URGENCY_STYLES = {
  Critical: 'bg-red-100 text-red-800',
  High: 'bg-orange-100 text-orange-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Low: 'bg-green-100 text-green-800',
};

const EXAMPLES = [
  'Our production server has been down for 20 minutes. Customers cannot log in.',
  'The CSV export just spins forever — I need this for a report due tomorrow morning.',
  'I was charged twice this month. Invoice number INV-2891. Please refund the duplicate.',
  'Would love to see dark mode added to the dashboard!',
  "Just wanted to say your onboarding flow is incredible. Made switching painless.",
];

function HomePage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, today: 0 });
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('triageHistory') || '[]');
    const today = new Date().toDateString();
    const todayCount = history.filter(
      (item) => new Date(item.timestamp).toDateString() === today
    ).length;

    setStats({ total: history.length, today: todayCount });

    // Most recent 3, newest first
    const sorted = [...history].sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
    setRecentActivity(sorted.slice(0, 3));
  }, []);

  const tryExample = () => {
    const example = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];
    localStorage.setItem('exampleMessage', example);
    navigate('/analyze');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">

        {/* Hero */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to Relay AI Customer Triage
          </h1>
          <p className="text-lg text-gray-600 mb-3">
            AI-powered message categorization and routing for customer support teams
          </p>
          <p className="text-gray-600 text-sm leading-relaxed">
            Relay AI categorizes incoming customer messages, scores urgency from full
            message context, and routes each ticket to the right team — helping small
            businesses handle more volume without hiring additional support staff.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-gray-600 mt-1">Total messages analyzed</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="text-3xl font-bold text-green-600">{stats.today}</div>
            <div className="text-sm text-gray-600 mt-1">Analyzed today</div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Link
            to="/analyze"
            className="bg-blue-600 text-white rounded-lg p-6 hover:bg-blue-700 transition-colors"
          >
            <div className="text-2xl mb-2">📝</div>
            <div className="font-semibold mb-1">Analyze message</div>
            <div className="text-sm text-blue-100">Triage a new customer message</div>
          </Link>

          <Link
            to="/history"
            className="bg-purple-600 text-white rounded-lg p-6 hover:bg-purple-700 transition-colors"
          >
            <div className="text-2xl mb-2">📊</div>
            <div className="font-semibold mb-1">View history</div>
            <div className="text-sm text-purple-100">See past analyses</div>
          </Link>

          <button
            onClick={tryExample}
            className="bg-orange-600 text-white rounded-lg p-6 hover:bg-orange-700 transition-colors text-left"
          >
            <div className="text-2xl mb-2">🎯</div>
            <div className="font-semibold mb-1">Try an example</div>
            <div className="text-sm text-orange-100">Load a sample message</div>
          </button>
        </div>

        {/* Recent activity */}
        {recentActivity.length > 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recent activity</h2>
            <div className="space-y-3">
              {recentActivity.map((item, index) => (
                <div key={index} className="border-l-4 border-blue-400 pl-4 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-400 mb-0.5">
                        {new Date(item.timestamp).toLocaleString()}
                      </div>
                      <div className="text-gray-700 text-sm truncate">
                        "{item.message.substring(0, 80)}{item.message.length > 80 ? '…' : ''}"
                      </div>
                      <div className="flex items-center flex-wrap gap-2 mt-1">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium">
                          {item.category}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-medium ${
                            URGENCY_STYLES[item.urgency] || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {item.urgency}
                        </span>
                        {item.confidence !== undefined && (
                          <span className="text-xs text-gray-400">
                            {item.confidence}% confident
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-4xl mb-3">📭</div>
            <div className="text-gray-600 mb-4">No messages analyzed yet</div>
            <Link
              to="/analyze"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-semibold"
            >
              Analyze your first message
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default HomePage;
