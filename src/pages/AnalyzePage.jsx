import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { categorizeMessage } from "../utils/llmHelper";
import { calculateUrgency } from "../utils/urgencyScorer";
import { getRecommendedAction } from "../utils/templates";

// Define standard categories and urgencies for the UI dropdowns
const CATEGORIES = [
  "Technical Support",
  "Billing & Subscription",
  "Product Question",
  "Feature Request",
  "Account Management",
  "Spam/Other",
];

const URGENCIES = ["High", "Medium", "Low"];

const QUICK_ACTIONS = [
  {
    label: "Request Screenshots",
    text: "Could you please provide screenshots of the issue to help us investigate further?",
  },
  {
    label: "Escalate to Tier 2",
    text: "I am escalating this ticket to our Tier 2 support team for deeper investigation.",
  },
  {
    label: "Schedule Call",
    text: "Would you be available for a quick 15-minute call to troubleshoot this live?",
  },
];

function AnalyzePage() {
  const [message, setMessage] = useState("");
  const [results, setResults] = useState(null);

  // Track original AI predictions for both fields
  const [originalCategory, setOriginalCategory] = useState(null);
  const [originalUrgency, setOriginalUrgency] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    // Check for example message from home page
    const exampleMessage = localStorage.getItem("exampleMessage");
    if (exampleMessage) {
      setMessage(exampleMessage);
      localStorage.removeItem("exampleMessage");
    }
  }, []);

  const handleAnalyze = async () => {
    if (!message.trim()) {
      alert("Please enter a message to analyze");
      return;
    }

    setIsLoading(true);
    setResults(null);
    setOriginalCategory(null);
    setOriginalUrgency(null);
    setIsSaved(false);

    try {
      // Run categorization (LLM call)
      const { category, reasoning } = await categorizeMessage(message);

      // Calculate urgency (rule-based)
      const urgency = calculateUrgency(message);

      // Get recommended action (template-based)
      const recommendedAction = getRecommendedAction(category);

      const analysisResult = {
        message,
        category,
        urgency,
        recommendedAction,
        reasoning,
        timestamp: new Date().toISOString(),
      };

      setResults(analysisResult);

      // Store the AI's original choices
      setOriginalCategory(category);
      setOriginalUrgency(urgency);
    } catch (error) {
      console.error("Error analyzing message:", error);
      alert("Error analyzing message. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setMessage("");
    setResults(null);
    setOriginalCategory(null);
    setOriginalUrgency(null);
    setIsSaved(false);
  };

  // Handle manual category correction
  const handleCategoryChange = (newCategory) => {
    setResults((prev) => ({
      ...prev,
      category: newCategory,
      // Automatically "give help" by pulling the template for the new category
      recommendedAction: getRecommendedAction(newCategory),
    }));
  };

  // Handle manual urgency correction
  const handleUrgencyChange = (newUrgency) => {
    setResults((prev) => ({
      ...prev,
      urgency: newUrgency,
    }));
  };

  // Handle manual action editing
  const handleActionChange = (newAction) => {
    setResults((prev) => ({
      ...prev,
      recommendedAction: newAction,
    }));
  };

  // Append quick action text to the current recommendation
  const appendQuickAction = (text) => {
    setResults((prev) => ({
      ...prev,
      recommendedAction: prev.recommendedAction + "\n\n" + text,
    }));
  };

  // Commit the verified data to history
  const handleSave = () => {
    const history = JSON.parse(localStorage.getItem("triageHistory") || "[]");

    const finalResult = {
      ...results,
      timestamp: new Date().toISOString(),
    };

    history.push(finalResult);
    localStorage.setItem("triageHistory", JSON.stringify(history));

    setIsSaved(true);
  };

  // Helper to generate unique dropdown options for Categories
  const getCategoryOptions = () => {
    if (!results) return CATEGORIES;

    const distinctCategories = new Set(
      [...CATEGORIES, originalCategory, results.category].filter(Boolean),
    );

    return Array.from(distinctCategories);
  };

  // Helper to generate unique dropdown options for Urgency
  const getUrgencyOptions = () => {
    if (!results) return URGENCIES;

    const distinctUrgencies = new Set(
      [...URGENCIES, originalUrgency, results.urgency].filter(Boolean),
    );

    return Array.from(distinctUrgencies);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Analyze Customer Message
          </h1>
          <p className="text-gray-600 mb-6">
            Paste a customer support message below to automatically categorize
            and prioritize.
          </p>

          {/* Input Section */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Customer Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Paste customer message here..."
              className="w-full border border-gray-300 rounded-lg p-3 h-40 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading || (results && !isSaved)}
            />
            <div className="text-sm text-gray-500 mt-1">
              {message.length} characters
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={handleAnalyze}
              disabled={isLoading || (results && !isSaved)}
              className={`flex-1 py-3 rounded-lg font-semibold ${
                isLoading || (results && !isSaved)
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin h-5 w-5 mr-2"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Analyzing...
                </span>
              ) : (
                "Analyze Message"
              )}
            </button>
            <button
              onClick={handleClear}
              disabled={isLoading}
              className="px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Results Section */}
        {results && (
          <div
            className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${isSaved ? "border-green-500" : "border-blue-500"}`}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {isSaved ? "Analysis Saved" : "Review & Edit Analysis"}
                </h2>
                {!isSaved && (
                  <p className="text-sm text-gray-500">
                    Review the AI suggestions. Correct the category or text if
                    needed, then save.
                  </p>
                )}
              </div>
              {isSaved && (
                <span className="bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wide">
                  Saved to History
                </span>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category Selection */}
                <div>
                  <div className="text-sm font-semibold text-gray-600 mb-1 flex justify-between">
                    <span>Category</span>
                    {results.category === originalCategory && (
                      <span className="text-blue-600 text-xs flex items-center font-bold">
                        ✨ AI Match
                      </span>
                    )}
                  </div>
                  {isSaved ? (
                    <div className="inline-block bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-semibold w-full">
                      {results.category}
                    </div>
                  ) : (
                    <div className="relative">
                      <select
                        value={results.category}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                      >
                        {getCategoryOptions().map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}{" "}
                            {cat === originalCategory
                              ? "✨ (AI Suggested)"
                              : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Urgency Selection */}
                <div>
                  <div className="text-sm font-semibold text-gray-600 mb-1 flex justify-between">
                    <span>Urgency Level</span>
                    {results.urgency === originalUrgency && (
                      <span className="text-blue-600 text-xs flex items-center font-bold">
                        ✨ AI Match
                      </span>
                    )}
                  </div>
                  {isSaved ? (
                    <div
                      className={`inline-block px-4 py-2 rounded-lg font-semibold w-full ${
                        results.urgency === "High"
                          ? "bg-red-200 text-red-900"
                          : results.urgency === "Medium"
                            ? "bg-yellow-200 text-yellow-900"
                            : "bg-green-200 text-green-900"
                      }`}
                    >
                      {results.urgency}
                    </div>
                  ) : (
                    <select
                      value={results.urgency}
                      onChange={(e) => handleUrgencyChange(e.target.value)}
                      className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                    >
                      {getUrgencyOptions().map((urg) => (
                        <option key={urg} value={urg}>
                          {urg}{" "}
                          {urg === originalUrgency ? "✨ (AI Suggested)" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Recommended Action - Editable */}
              <div>
                <div className="flex justify-between items-end mb-1">
                  <div className="text-sm font-semibold text-gray-600">
                    Recommended Action
                  </div>
                  {!isSaved && (
                    <div className="text-xs text-blue-600">Editable</div>
                  )}
                </div>

                {isSaved ? (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 whitespace-pre-wrap">
                    <p className="text-gray-800">{results.recommendedAction}</p>
                  </div>
                ) : (
                  <div>
                    <textarea
                      value={results.recommendedAction}
                      onChange={(e) => handleActionChange(e.target.value)}
                      className="w-full border border-purple-200 bg-purple-50 rounded-lg p-4 text-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 min-h-[100px]"
                    />

                    {/* Quick Actions Helper */}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="text-xs text-gray-500 py-1">
                        Quick Add:
                      </span>
                      {QUICK_ACTIONS.map((action, idx) => (
                        <button
                          key={idx}
                          onClick={() => appendQuickAction(action.text)}
                          className="text-xs bg-white border border-gray-300 text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                          title={action.text}
                        >
                          + {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm font-semibold text-gray-600 mb-1">
                  AI Reasoning
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="prose prose-sm max-w-none text-gray-700">
                    <ReactMarkdown>{results.reasoning}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200 flex space-x-3">
              {!isSaved ? (
                <button
                  onClick={handleSave}
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-semibold shadow-sm transition-all"
                >
                  ✓ Confirm & Save to History
                </button>
              ) : (
                <button
                  onClick={() => {
                    const text = `Category: ${results.category}\nUrgency: ${results.urgency}\nRecommendation: ${results.recommendedAction}\n\nReasoning: ${results.reasoning}`;
                    navigator.clipboard.writeText(text);
                    alert("Results copied to clipboard!");
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-200 font-semibold border border-gray-300"
                >
                  📋 Copy Results
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AnalyzePage;
