import React, { useMemo, useReducer, useEffect } from 'react';

const EPS_SUM = 0.02; // tolerance for sum-to-1 checks
const EPS_MATCH = 0.01; // tolerance for user-entered EU checks

function parseProb(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

const initialState = {
  phase: 1,

  actions: ['Action 1', 'Action 2'],
  states: ['State 1', 'State 2'],

  stateProbs: ['', ''],
  outcomes: {},
  rankedOutcomes: [],

  currentEvalIndex: 1,
  probability: 0.5, 
  utilities: {},

  consistencyStep: 0,
  checkOffsets: { high: 0.1, low: 0.1 },
  checkQueue: [],

  euInputs: {}, 
  euResults: null, 
};

function reducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return { ...initialState };

    case 'SET_PHASE':
      return { ...state, phase: action.phase };

    case 'SET_ACTION_NAME': {
      const next = [...state.actions];
      next[action.index] = action.value;
      return { ...state, actions: next };
    }

    case 'SET_STATE_NAME': {
      const next = [...state.states];
      next[action.index] = action.value;
      return { ...state, states: next };
    }

    case 'SET_STATE_PROB': {
      const next = [...state.stateProbs];
      next[action.index] = action.value;
      return { ...state, stateProbs: next };
    }

    case 'ADD_ACTION':
      return { ...state, actions: [...state.actions, `Action ${state.actions.length + 1}`] };

    case 'ADD_STATE':
      return {
        ...state,
        states: [...state.states, `State ${state.states.length + 1}`],
        stateProbs: [...state.stateProbs, ''],
      };

    case 'SET_OUTCOME': {
      const key = `${action.aIndex}-${action.sIndex}`;
      return {
        ...state,
        outcomes: { ...state.outcomes, [key]: action.value },
      };
    }

    case 'SET_RANKED_OUTCOMES':
      return { ...state, rankedOutcomes: action.rankedOutcomes };

    case 'MOVE_OUTCOME': {
      const { index, direction } = action;
      const next = [...state.rankedOutcomes];
      if (direction === 'up' && index > 0) {
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
      } else if (direction === 'down' && index < next.length - 1) {
        [next[index + 1], next[index]] = [next[index], next[index + 1]];
      }
      return { ...state, rankedOutcomes: next };
    }

    case 'START_ELICITATION': {
      const ro = state.rankedOutcomes;
      const initialUtils = {
        [ro[0]]: 1,
        [ro[ro.length - 1]]: 0,
      };

      if (ro.length <= 2) {
        return {
          ...state,
          utilities: initialUtils,
          phase: 4,
        };
      }

      return {
        ...state,
        utilities: initialUtils,
        currentEvalIndex: 1,
        probability: 0.5,
        consistencyStep: 0,
        checkQueue: [],
        phase: 3,
      };
    }

    case 'SET_PROBABILITY':
      return { ...state, probability: clamp01(action.value) };

    case 'SET_CHECK_STATE':
      return {
        ...state,
        checkOffsets: action.checkOffsets,
        checkQueue: action.checkQueue,
        consistencyStep: action.consistencyStep,
      };

    case 'CANCEL_CHECK':
      return { ...state, consistencyStep: 0 };

    case 'FAIL_CHECK':
      return { ...state, consistencyStep: 0, checkQueue: [] };

    case 'COMPLETE_EVAL': {
      const currentOutcome = state.rankedOutcomes[state.currentEvalIndex];
      const nextUtilities = { ...state.utilities, [currentOutcome]: clamp01(action.utilityValue) };

      const isMore = state.currentEvalIndex < state.rankedOutcomes.length - 2;
      if (isMore) {
        return {
          ...state,
          utilities: nextUtilities,
          currentEvalIndex: state.currentEvalIndex + 1,
          probability: 0.5,
          consistencyStep: 0,
          checkQueue: [],
        };
      }

      return {
        ...state,
        utilities: nextUtilities,
        phase: 4,
      };
    }

    case 'SET_EU_INPUT': {
      const key = action.key;
      return { ...state, euInputs: { ...state.euInputs, [key]: action.value } };
    }

    case 'SET_EU_RESULTS':
      return { ...state, euResults: action.euResults };

    default:
      return state;
  }
}

const Footer = () => (
    <footer style={{ 
      position: 'fixed',
      bottom: 0,
      left: 0,
      width: '100%',
      backgroundColor: '#343a40', 
      color: '#ffffff',
      padding: '1rem',
      textAlign: 'center', 
      fontSize: '0.95rem',
      boxShadow: '0 -2px 10px rgba(0,0,0,0.15)',
      zIndex: 1000,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '15px' // Adds a nice space between your name and the icon
    }}>
      <span>
        &copy; 2026 <a href="https://loighic.net/" target="_blank" rel="noopener noreferrer" className="author-link">
          Gregory Scott Johnson
        </a>
      </span>

      {/* GitHub Icon Link */}
      <a href="https://github.com/loighic/vnm-utility" target="_blank" rel="noopener noreferrer" className="github-link" style={{ display: 'flex', alignItems: 'center' }}>
        <svg height="22" width="22" viewBox="0 0 16 16" fill="#ffffff" style={{ cursor: 'pointer' }}>
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
        </svg>
      </a>
    </footer>
  );


function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // --- STAGE 4 OVERALL CONSISTENCY CHECK ---
  useEffect(() => {
    if (state.phase === 4) {
      let isConsistent = true;
      for (let i = 0; i < state.rankedOutcomes.length - 1; i++) {
        const utilA = state.utilities[state.rankedOutcomes[i]];
        const utilB = state.utilities[state.rankedOutcomes[i + 1]];
        if (utilA <= utilB) {
          isConsistent = false;
          break;
        }
      }

      if (!isConsistent) {
        // A slight delay lets the browser draw the Stage 4 table so the user can see their error
        const timer = setTimeout(() => {
          alert(
            "The utility values you've set contradict your ranking from Stage 2.\n\n" +
            "You assigned a lower-ranked outcome a utility value that is equal to or higher than a more-preferred outcome.\n\n" +
            "Review your ranking and try setting the utility values again."
          );
          dispatch({ type: 'SET_PHASE', phase: 2 });
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [state.phase, state.rankedOutcomes, state.utilities]);

  // --- REUSABLE STYLES FOR CENTERING ---
	const outerContainerStyle = {
		minHeight: '100vh',
		width: '100%',
		display: 'flex',
		flexDirection: 'column', 
		alignItems: 'center',
		justifyContent: 'flex-start', // <-- Changed from 'center'
		padding: '1rem 2rem 5rem 2rem', // <-- Change the first number (top padding) as needed.
		boxSizing: 'border-box',
		fontFamily: "'Lato', sans-serif",
		backgroundColor: '#fdfdfd',
		};

  const innerContainerStyle = {
    width: '100%',
    maxWidth: '900px',
    margin: '0 auto',
  };


  const bestOutcome = useMemo(() => {
    if (!state.rankedOutcomes.length) return '';
    return state.rankedOutcomes[0];
  }, [state.rankedOutcomes]);

  const worstOutcome = useMemo(() => {
    if (!state.rankedOutcomes.length) return '';
    return state.rankedOutcomes[state.rankedOutcomes.length - 1];
  }, [state.rankedOutcomes]);

  const handleStartOver = () => {
    if (window.confirm("Are you sure you want to start over? All of your entered data and utility values will be lost.")) {
      dispatch({ type: 'RESET' });
    }
  };

  const goToPhase2 = () => {
    const parsed = state.stateProbs.map((p) => parseProb(p.trim()));
    if (parsed.some((n) => !Number.isFinite(n))) {
      alert('Please enter a numeric probability for every State of Nature before proceeding.');
      return;
    }
    if (parsed.some((n) => n < 0 || n > 1)) {
      alert('Each probability must be between 0 and 1.');
      return;
    }
    const sum = parsed.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > EPS_SUM) {
      alert(`The probabilities for the states of the world should sum to 1. Right now they sum to ${sum.toFixed(2)}.`);
      return;
    }

    const allOutcomes = Object.values(state.outcomes);
    const uniqueOutcomes = [...new Set(allOutcomes.map((v) => (v ?? '').trim()).filter(Boolean))];

    if (uniqueOutcomes.length < 2) {
      alert('Please enter at least two distinct outcomes in the table.');
      return;
    }

    dispatch({ type: 'SET_RANKED_OUTCOMES', rankedOutcomes: uniqueOutcomes });
    dispatch({ type: 'SET_PHASE', phase: 2 });
  };

  const handleConfirmIndifference = () => {
    const probNum = clamp01(state.probability);
    const rHigh = (Math.floor(Math.random() * 6) + 8) / 100; 
    const rLow = (Math.floor(Math.random() * 6) + 8) / 100;

    const canHigh = probNum + rHigh <= 1.0;
    const canLow = probNum - rLow >= 0.0;

    let queue = [];
    if (canHigh && canLow) {
      queue = Math.random() < 0.5 ? [1, 2] : [2, 1];
    } else if (canHigh) {
      queue = [1];
    } else if (canLow) {
      queue = [2];
    }

    if (queue.length > 0) {
      dispatch({
        type: 'SET_CHECK_STATE',
        checkOffsets: { high: rHigh, low: rLow },
        checkQueue: queue,
        consistencyStep: queue[0],
      });
    } else {
      dispatch({ type: 'COMPLETE_EVAL', utilityValue: probNum });
    }
  };

  const failCheck = (probNum, failedStep) => {
    const direction = failedStep === 1 ? 'UP' : 'DOWN';
    const expectedChoice = failedStep === 1 ? 'the lottery' : 'the guaranteed outcome, (1)';

    alert(
      `Hold on! You indicated you were indifferent when the probability of winning the lottery was ${Math.round(probNum * 100)}%.\n\n` +
        `Logically, if the odds of winning the lottery go ${direction}, you should prefer ${expectedChoice}. Your choice between (1) and (2) right now contradicted this.\n\n` +
        `Try again finding a probability where you are indifferent.`
    );

    dispatch({ type: 'FAIL_CHECK' });
  };

  const handleCheckChoice = (choice) => {
    const probNum = clamp01(state.probability);
    const currentTest = state.consistencyStep;

    let passed = false;
    if (currentTest === 1) {
      passed = choice === 'lottery';
    } else if (currentTest === 2) {
      passed = choice === 'certain';
    }

    if (!passed) {
      failCheck(probNum, currentTest);
      return;
    }

    const nextQueue = state.checkQueue.slice(1);
    if (nextQueue.length > 0) {
      dispatch({
        type: 'SET_CHECK_STATE',
        checkOffsets: state.checkOffsets,
        checkQueue: nextQueue,
        consistencyStep: nextQueue[0],
      });
    } else {
      dispatch({ type: 'COMPLETE_EVAL', utilityValue: probNum });
    }
  };

  const calculateEU = () => {
    const newResults = {};
    let maxTotal = -Infinity;

    const actualPs = state.stateProbs.map((p) => parseProb(p.trim()));

    for (let aIndex = 0; aIndex < state.actions.length; aIndex++) {
      let step2Arr = [];
      let totalEU = 0;

      for (let sIndex = 0; sIndex < state.states.length; sIndex++) {
        const enteredP = parseProb(state.euInputs[`${aIndex}-${sIndex}-p`]);
        const enteredU = parseProb(state.euInputs[`${aIndex}-${sIndex}-u`]);

        const actualP = actualPs[sIndex];
        const outcomeText = (state.outcomes[`${aIndex}-${sIndex}`] ?? '').trim();
        const actualU = state.utilities[outcomeText];

        if (!Number.isFinite(actualP)) {
          alert('Your probabilities are missing or invalid. Go back to Stage 1 and fix them.');
          return;
        }
        if (!outcomeText) {
          alert(`Missing an outcome for ${state.actions[aIndex]} under ${state.states[sIndex]}.`);
          return;
        }
        if (!Number.isFinite(actualU)) {
          alert(`Missing a utility for outcome "${outcomeText}".`);
          return;
        }

        if (!Number.isFinite(enteredP) || Math.abs(enteredP - actualP) > EPS_MATCH) {
          alert(
            `The probability you entered for ${state.actions[aIndex]} under ${state.states[sIndex]} does not match the table.`
          );
          return;
        }
        if (!Number.isFinite(enteredU) || Math.abs(enteredU - actualU) > EPS_MATCH) {
          alert(
            `The utility value you entered for ${state.actions[aIndex]} under ${state.states[sIndex]} does not match the table.`
          );
          return;
        }

        const product = actualP * actualU;
        step2Arr.push(product.toFixed(2));
        totalEU += product;
      }

      newResults[aIndex] = {
        step2Str: step2Arr.join(' + '),
        total: totalEU,
      };

      if (totalEU > maxTotal) maxTotal = totalEU;
    }

    for (let aIndex in newResults) {
      newResults[aIndex].isMax = Math.abs(newResults[aIndex].total - maxTotal) < 0.001;
    }

    dispatch({ type: 'SET_EU_RESULTS', euResults: newResults });
  };

  // --- DYNAMIC CONTENT RENDERING ---
  let content = null;

  if (state.phase === 1) {
    content = (
      <div style={outerContainerStyle}>
        <div style={innerContainerStyle}>
          <h1 style={{ textAlign: 'center' }}>Setting utility values</h1>

          <p style={{ textAlign: 'left', lineHeight: '1.6' }}>
            This website will take you through the von Neumann-Morgenstern method for setting utility values. In the
            first stage, you should define a decision problem, including probabilities for each state of the world. In the
            second stage, you order the outcomes from most to least preferred. In stage 3, you determine the utility
            values for the intermediate outcomes. In stage 4, your utility values for each unique outcome are listed.
            And in stage 5, you can calculate the expected utility for each option.
          </p>

          <h2 style={{ textAlign: 'center' }}>Stage 1: The Decision Table</h2>
          <p style={{ textAlign: 'center', lineHeight: '1.6' }}>
            Define your actions, states of nature, and the resulting outcomes.
          </p>

          <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <button onClick={() => dispatch({ type: 'ADD_ACTION' })} style={{ padding: '0.5rem 1rem' }}>
              + Add Action (Row)
            </button>
            <button onClick={() => dispatch({ type: 'ADD_STATE' })} style={{ padding: '0.5rem 1rem' }}>
              + Add State of Nature (Column)
            </button>
          </div>

          <div style={{ overflowX: 'auto', marginBottom: '2rem', width: '100%' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '500px', tableLayout: 'auto' }}>
              <thead>
                <tr>
                  <th
                    style={{
                      border: '1px solid #ccc',
                      padding: '0.5rem',
                      backgroundColor: '#e9ecef',
                      width: '150px',
                      minWidth: '150px',
                    }}
                  ></th>
                  {state.states.map((st, sIndex) => (
                    <th
                      key={sIndex}
                      style={{
                        border: '1px solid #ccc',
                        padding: '0.5rem',
                        backgroundColor: '#f8f9fa',
                        verticalAlign: 'bottom',
                      }}
                    >
                      <div style={{ marginBottom: '0.5rem' }}>
                        <input
                          type="text"
                          aria-label={`Probability for ${st}`}
                          placeholder="Prob (e.g. .50)"
                          value={state.stateProbs[sIndex]}
                          onChange={(e) => dispatch({ type: 'SET_STATE_PROB', index: sIndex, value: e.target.value })}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            textAlign: 'center',
                            fontSize: '0.85rem',
                            padding: '0.2rem',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                          }}
                        />
                      </div>
                      <input
                        type="text"
                        aria-label={`State ${sIndex + 1} name`}
                        value={st}
                        onChange={(e) => dispatch({ type: 'SET_STATE_NAME', index: sIndex, value: e.target.value })}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          fontWeight: 'bold',
                          width: '100%',
                          textAlign: 'center',
                          fontSize: '1rem',
                        }}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.actions.map((act, aIndex) => (
                  <tr key={aIndex}>
                    <td style={{ border: '1px solid #ccc', padding: '0.5rem', backgroundColor: '#f8f9fa' }}>
                      <input
                        type="text"
                        aria-label={`Action ${aIndex + 1} name`}
                        value={act}
                        onChange={(e) => dispatch({ type: 'SET_ACTION_NAME', index: aIndex, value: e.target.value })}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          fontWeight: 'bold',
                          width: '100%',
                          fontSize: '1rem',
                        }}
                      />
                    </td>
                    {state.states.map((st, sIndex) => (
                      <td key={sIndex} style={{ border: '1px solid #ccc', padding: '0' }}>
                        <input
                          type="text"
                          aria-label={`Outcome for ${act} under ${st}`}
                          placeholder="Enter outcome..."
                          value={state.outcomes[`${aIndex}-${sIndex}`] || ''}
                          onChange={(e) =>
                            dispatch({ type: 'SET_OUTCOME', aIndex, sIndex, value: e.target.value })
                          }
                          style={{
                            width: '100%',
                            border: 'none',
                            outline: 'none',
                            padding: '0.75rem',
                            boxSizing: 'border-box',
                            fontSize: '1rem',
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ textAlign: 'center' }}>
            <button
              onClick={goToPhase2}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1.1rem',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Proceed to Ranking
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  } else if (state.phase === 2) {
    content = (
      <div style={outerContainerStyle}>
        <div style={{ ...innerContainerStyle, maxWidth: '600px' }}>
          <h1 style={{ textAlign: 'center' }}>Setting utility values</h1>
          <h2 style={{ textAlign: 'center' }}>Stage 2: Rank Your Outcomes</h2>
          <p style={{ textAlign: 'center', lineHeight: '1.6' }}>
            Rank the unique outcomes from <strong>most preferred</strong> (top) to{' '}
            <strong>least preferred</strong> (bottom).
          </p>

          <ul style={{ listStyleType: 'none', padding: 0, width: '100%' }}>
            {state.rankedOutcomes.map((outcome, index) => (
              <li
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  border: '1px solid #ccc',
                  backgroundColor: '#f9f9f9',
                  marginBottom: '10px',
                  borderRadius: '4px',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>
                  <strong>{index + 1}.</strong> {outcome}
                </span>
                <div>
                  <button
                    aria-label={`Move ${outcome} up`}
                    onClick={() => dispatch({ type: 'MOVE_OUTCOME', index, direction: 'up' })}
                    disabled={index === 0}
                    style={{
                      marginRight: '5px',
                      cursor: index === 0 ? 'not-allowed' : 'pointer',
                      padding: '0.25rem 0.5rem',
                    }}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Move ${outcome} down`}
                    onClick={() => dispatch({ type: 'MOVE_OUTCOME', index, direction: 'down' })}
                    disabled={index === state.rankedOutcomes.length - 1}
                    style={{
                      cursor: index === state.rankedOutcomes.length - 1 ? 'not-allowed' : 'pointer',
                      padding: '0.25rem 0.5rem',
                    }}
                  >
                    ↓
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <button onClick={() => dispatch({ type: 'SET_PHASE', phase: 1 })} style={{ padding: '0.75rem 1.5rem' }}>
              Back to Table
            </button>
            <button
              onClick={() => dispatch({ type: 'START_ELICITATION' })}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Set Utility Values
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  } else if (state.phase === 3) {
    const currentOutcome = state.rankedOutcomes[state.currentEvalIndex];
    const colorBest = '#cc0000'; // Brighter Red
    const colorWorst = '#000000'; // Black

    let displayProb = state.probability;
    if (state.consistencyStep === 1) displayProb = Math.min(1.0, state.probability + state.checkOffsets.high);
    if (state.consistencyStep === 2) displayProb = Math.max(0.0, state.probability - state.checkOffsets.low);

    const probBest = displayProb;
    const probWorst = 1 - probBest;
    const isChecking = state.consistencyStep > 0;

    const clickableOptionStyle = isChecking
      ? {
          cursor: 'pointer',
          padding: '1rem',
          margin: '-1rem',
          borderRadius: '8px',
          border: '2px dashed #007bff',
          backgroundColor: '#e9ecef',
          transition: 'background-color 0.2s ease',
        }
      : { padding: '1rem', margin: '-1rem', border: '2px solid transparent' };

    content = (
      <div style={outerContainerStyle}>
        <div style={innerContainerStyle}>
          <h1 style={{ textAlign: 'center' }}>Setting utility values</h1>
          <h2 style={{ textAlign: 'center' }}>Stage 3: The Standard Lottery</h2>

          <div style={{ textAlign: 'left', minHeight: '3rem', marginBottom: '1rem' }}>
			{!isChecking ? (
				<>
					<p style={{ lineHeight: '1.6', marginBottom: '0.5rem' }}>
						Here, you are presented with a choice between <strong>(1)</strong>, one of the outcomes in your decision problem, and <strong>(2)</strong>, a lottery between your most and least preferred outcomes.
					</p>
					<p style={{ lineHeight: '1.6', marginTop: '0' }}>
						Your task is to think about which one of these you would choose for different probabilities of winning the lottery. Move the slider to adjust that probability. Ultimately, you want to find the probability of winning the lottery that will make you indifferent between (1) and (2). See these <a href="https://youtu.be/qAxERI8GbaY?si=Sy_bv4m54nM-5Prm&t=188" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: '#007bff' }}>two</a> <a href="https://youtu.be/HXXgJXYa0Zs?si=fsPzBuDzqNbuIdjq&t=82" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: '#007bff' }}>videos</a> for more explanation.
					</p>
					<hr style={{ border: 'none', borderTop: '1px solid #ddd', margin: '1rem 0' }} />
					<p style={{ lineHeight: '1.6' }}>
						Adjust the slider until you are completely indifferent between (1) and (2).
					</p>
				</>
			) : (
              <p style={{ color: '#007bff', fontWeight: 'bold', fontSize: '1.1rem', lineHeight: '1.6' }}>
                Consistency Check: We adjusted the odds. Click on the option you now prefer.
              </p>
            )}
          </div>

          <div
            style={{
              maxWidth: '750px',
              width: '100%',
              margin: '0 auto 2rem auto',
              padding: '2rem',
              backgroundColor: '#f4f1ea',
              border: '1px solid #dcdcdc',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            }}
          >
            <div
              style={{ ...clickableOptionStyle, marginBottom: '1.5rem' }}
              onClick={() => isChecking && handleCheckChoice('certain')}
            >
              <div style={{ fontSize: '1.5rem', fontWeight: '500', paddingLeft: '2rem' }}>
                <span style={{ color: '#888' }}>(1)</span> <span style={{ color: '#007bff' }}>{currentOutcome}</span>
              </div>
            </div>

            <div style={clickableOptionStyle} onClick={() => isChecking && handleCheckChoice('lottery')}>
              <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', fontSize: '1.5rem', fontWeight: '500' }}>
                  <div style={{ marginRight: '1.5rem', color: '#007bff' }}>
                    <span style={{ color: '#888' }}>(2)</span> a lottery between
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, maxWidth: '280px', position: 'relative', top: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.8rem', borderBottom: '2px solid #aaa' }}>
                      <span style={{ paddingLeft: '2.0rem', color: '#007bff' }}>{bestOutcome}</span>
                      <span style={{ fontWeight: 'bold', color: colorBest }}>{probBest.toFixed(2).replace(/^0+/, '')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.8rem' }}>
                      <span style={{ paddingLeft: '2.0rem', color: '#007bff' }}>{worstOutcome}</span>
                      <span style={{ fontWeight: 'bold', color: colorWorst }}>{probWorst.toFixed(2).replace(/^0+/, '')}</span>
                    </div>
                  </div>

                  <div
                    style={{
                      width: 'min(160px, 30vw)',
                      height: 'min(160px, 30vw)',
                      marginLeft: '3rem',
                      borderRadius: '50%',
                      background: `conic-gradient(${colorBest} ${probBest * 100}%, ${colorWorst} 0)`,
                      border: '2px solid #ccc',
                      boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                      flexShrink: 0,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {!isChecking ? (
            <>
              <div style={{ margin: '2rem auto', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
                <input
                  type="range"
                  aria-label="Probability of best outcome"
                  min="0"
                  max="1"
                  step="0.01"
                  value={state.probability}
                  onChange={(e) => dispatch({ type: 'SET_PROBABILITY', value: Number(e.target.value) })}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>
              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={handleConfirmIndifference}
                  style={{
                    padding: '1rem 2rem',
                    fontSize: '1.2rem',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Confirm Indifference
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <button
                onClick={() => dispatch({ type: 'CANCEL_CHECK' })}
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Cancel & Adjust Slider
              </button>
            </div>
          )}
        </div>
        <Footer />
      </div>
    );
  } else if (state.phase === 4) {
    content = (
      <div style={outerContainerStyle}>
        <div style={{ ...innerContainerStyle, maxWidth: '600px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h1 style={{ textAlign: 'center' }}>Setting utility values</h1>
          <h2 style={{ textAlign: 'center' }}>Stage 4: Your Utility Function</h2>
          <p style={{ textAlign: 'center', lineHeight: '1.6' }}>
            Based on your choices, these are the calculated utility values for each outcome.
          </p>

          <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: '2rem', fontSize: '1.2rem' }}>
            <thead>
              <tr>
                <th style={{ borderBottom: '2px solid #333', padding: '1rem', textAlign: 'left' }}>Outcome</th>
                <th style={{ borderBottom: '2px solid #333', padding: '1rem', textAlign: 'right' }}>Utility</th>
              </tr>
            </thead>
            <tbody>
              {state.rankedOutcomes.map((outcome, index) => (
                <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'white' }}>
                  <td style={{ padding: '1rem', borderBottom: '1px solid #ccc' }}>{outcome}</td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid #ccc', textAlign: 'right', fontWeight: 'bold' }}>
                    {Number.isFinite(state.utilities[outcome]) ? state.utilities[outcome].toFixed(2) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'center', gap: '15px' }}>
            <button onClick={handleStartOver} style={{ padding: '1rem 2rem', fontSize: '1rem', cursor: 'pointer' }}>
              Start Over
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_PHASE', phase: 5 })}
              style={{
                padding: '1rem 2rem',
                fontSize: '1.1rem',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Calculate Expected Utility
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  } else if (state.phase === 5) {
    content = (
      <div style={outerContainerStyle}>
        <div style={innerContainerStyle}>
          <h1 style={{ textAlign: 'center' }}>Setting utility values</h1>
          <h2 style={{ textAlign: 'center' }}>Stage 5: Calculate Expected Utility</h2>
          <p style={{ textAlign: 'left', marginBottom: '2rem', lineHeight: '1.6' }}>
            Below is your decision table with the utility values that you have established for each outcome. Fill in the
            values below to calculate the expected utility (EU) of each action.
          </p>

          <div style={{ overflowX: 'auto', marginBottom: '3rem', width: '100%' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '500px', tableLayout: 'auto' }}>
              <thead>
                <tr>
                  <th
                    style={{
                      border: '1px solid #ccc',
                      padding: '0.5rem',
                      backgroundColor: '#e9ecef',
                      width: '150px',
                      minWidth: '150px',
                    }}
                  ></th>
                  {state.states.map((st, sIndex) => (
                    <th key={sIndex} style={{ border: '1px solid #ccc', padding: '0.5rem', backgroundColor: '#f8f9fa' }}>
                      <div style={{ color: '#007bff', fontSize: '0.9rem', marginBottom: '0.2rem' }}>
                        Probability = {state.stateProbs[sIndex] || '0'}
                      </div>
                      <div>{st}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.actions.map((act, aIndex) => (
                  <tr key={aIndex}>
                    <td style={{ border: '1px solid #ccc', padding: '0.5rem', backgroundColor: '#f8f9fa', fontWeight: 'bold' }}>
                      {act}
                    </td>
                    {state.states.map((_, sIndex) => {
                      const outcomeText = (state.outcomes[`${aIndex}-${sIndex}`] ?? '').trim();
                      const utilValue = state.utilities[outcomeText];
                      return (
                        <td
                          key={sIndex}
                          style={{
                            border: '1px solid #ccc',
                            padding: '1rem',
                            textAlign: 'center',
                            fontSize: '1.2rem',
                            fontWeight: 'bold',
                            color: '#28a745',
                          }}
                        >
                          {Number.isFinite(utilValue) ? utilValue.toFixed(2) : '0.00'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ width: '100%', fontSize: '1.2rem', marginBottom: '2rem' }}>
            {state.actions.map((act, aIndex) => (
              <div
                key={aIndex}
                style={{
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  padding: '1rem',
                  backgroundColor: state.euResults?.[aIndex]?.isMax ? '#e6f4ea' : '#fdfdfd',
                  border: '1px solid #ccc',
                  borderRadius: '8px',
                }}
              >
                <span style={{ fontWeight: 'bold', marginRight: '1rem', minWidth: '150px' }}>EU({act}) = </span>

                {state.states.map((_, sIndex) => (
                  <span key={sIndex} style={{ display: 'inline-flex', alignItems: 'center' }}>
                    (
                    <input
                      type="text"
                      placeholder="Prob"
                      aria-label={`Probability for ${state.actions[aIndex]} under ${state.states[sIndex]}`}
                      value={state.euInputs[`${aIndex}-${sIndex}-p`] || ''}
                      onChange={(e) =>
                        dispatch({ type: 'SET_EU_INPUT', key: `${aIndex}-${sIndex}-p`, value: e.target.value })
                      }
                      style={{
                        width: '50px',
                        textAlign: 'center',
                        fontSize: '1.1rem',
                        margin: '0 4px',
                        border: '1px solid #aaa',
                        borderRadius: '4px',
                      }}
                    />
                    )(
                    <input
                      type="text"
                      placeholder="Util"
                      aria-label={`Utility for ${state.actions[aIndex]} under ${state.states[sIndex]}`}
                      value={state.euInputs[`${aIndex}-${sIndex}-u`] || ''}
                      onChange={(e) =>
                        dispatch({ type: 'SET_EU_INPUT', key: `${aIndex}-${sIndex}-u`, value: e.target.value })
                      }
                      style={{
                        width: '50px',
                        textAlign: 'center',
                        fontSize: '1.1rem',
                        margin: '0 4px',
                        border: '1px solid #aaa',
                        borderRadius: '4px',
                      }}
                    />
                    )
                    {sIndex < state.states.length - 1 && <span style={{ margin: '0 10px', fontWeight: 'bold' }}>+</span>}
                  </span>
                ))}

                {state.euResults && state.euResults[aIndex] && (
                  <span style={{ marginLeft: '1rem', color: '#333' }}>
                    = {state.euResults[aIndex].step2Str} =
                    <span
                      style={{
                        fontWeight: state.euResults[aIndex].isMax ? 'bold' : 'normal',
                        fontSize: '1.4rem',
                        marginLeft: '0.5rem',
                        color: state.euResults[aIndex].isMax ? '#28a745' : 'inherit',
                      }}
                    >
                      {state.euResults[aIndex].total.toFixed(2)}
                    </span>
                  </span>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
            <button
              onClick={calculateEU}
              style={{
                padding: '1rem 2rem',
                fontSize: '1.2rem',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Calculate EU
            </button>
            <button onClick={handleStartOver} style={{ padding: '1rem 2rem', fontSize: '1rem', cursor: 'pointer' }}>
              Start Over
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Final wrapper returning the landscape prompt and the dynamically selected phase
  return (
    <>
      <style>{`
        #portrait-warning {
          display: none;
        }
        @media screen and (max-width: 768px) and (orientation: portrait) {
          #portrait-warning {
            display: flex;
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background-color: #343a40;
            color: white;
            z-index: 10000;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 2rem;
            font-family: 'Lato', sans-serif;
            box-sizing: border-box;
          }
          #app-content {
            display: none;
          }
        }
		
		/* --- HOVER EFFECT FOR GITHUB ICON --- */
        .github-link svg {
          transition: opacity 0.2s ease, transform 0.2s ease;
        }
        .github-link:hover svg {
          opacity: 0.7;
          transform: scale(1.15);
        }
		
		/* --- HOVER EFFECT FOR AUTHOR NAME --- */
        .author-link {
          color: #ffffff;
          text-decoration: none;
          font-weight: normal;
          transition: color 0.2s ease;
        }
        .author-link:hover {
          color: #66b2ff; /* Changes to a light blue on hover */
        }
		
      `}</style>
      
      <div id="portrait-warning">
        <h2 style={{ margin: '0 0 1rem 0' }}>Please rotate your device</h2>
        <p style={{ margin: 0, lineHeight: '1.5' }}>This tool requires a wider screen. Please rotate your phone sideways (landscape mode) to continue.</p>
      </div>

      <div id="app-content">
        {content}
      </div>
    </>
  );
}

export default App;