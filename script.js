document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const websiteUrlInput = document.getElementById('websiteUrl');
    const loadButton = document.getElementById('loadButton');
    const extractButton = document.getElementById('extractButton');
    const analyzeButton = document.getElementById('analyzeButton');
    const analyzeLogsButton = document.getElementById('analyzeLogs');
    const websiteFrame = document.getElementById('websiteFrame');
    const analysisResults = document.getElementById('analysisResults');
    const extractedCode = document.getElementById('extractedCode');
    const consoleLogs = document.getElementById('consoleLogs');
    
    // Store logs
    let capturedLogs = [];
    
    // Load website into iframe
    loadButton.addEventListener('click', function() {
        const url = websiteUrlInput.value.trim();
        if (url) {
            websiteFrame.src = url;
            capturedLogs = [];
            consoleLogs.textContent = 'Loading website...';
            
            // Set up message listener for communication with the iframe
            window.addEventListener('message', receiveMessage, false);
            
            // Inject console logger once the iframe is loaded
            websiteFrame.onload = function() {
                injectConsoleLogger();
            };
        }
    });
    
    // Extract code from iframe
    extractButton.addEventListener('click', function() {
        try {
            extractCodeFromIframe();
        } catch (error) {
            extractedCode.textContent = `Error extracting code: ${error.message}`;
        }
    });
    
    // Analyze extracted code
    analyzeButton.addEventListener('click', async function() {
        const code = extractedCode.textContent;
        if (code && code !== 'No code extracted yet.') {
            analysisResults.textContent = 'Analyzing code...';
            try {
                const analysis = await analyzeWithLLM(code, 'code');
                analysisResults.textContent = analysis;
            } catch (error) {
                analysisResults.textContent = `Error during analysis: ${error.message}`;
            }
        } else {
            analysisResults.textContent = 'Please extract code first.';
        }
    });
    
    // Analyze console logs
    analyzeLogsButton.addEventListener('click', async function() {
        if (capturedLogs.length > 0) {
            analysisResults.textContent = 'Analyzing logs...';
            try {
                const logsText = capturedLogs.join('\n');
                const analysis = await analyzeWithLLM(logsText, 'logs');
                analysisResults.textContent = analysis;
            } catch (error) {
                analysisResults.textContent = `Error during analysis: ${error.message}`;
            }
        } else {
            analysisResults.textContent = 'No logs captured yet.';
        }
    });
    
    // Function to extract code from iframe
    function extractCodeFromIframe() {
        extractedCode.textContent = 'Extracting code...';
        
        try {
            const iframeDocument = websiteFrame.contentDocument || websiteFrame.contentWindow.document;
            
            // Get HTML
            const html = iframeDocument.documentElement.outerHTML;
            
            // Get JS scripts
            const scripts = Array.from(iframeDocument.querySelectorAll('script'))
                .map(script => script.innerHTML)
                .filter(content => content.trim() !== '');
            
            // Get CSS styles
            const styles = Array.from(iframeDocument.querySelectorAll('style'))
                .map(style => style.innerHTML)
                .filter(content => content.trim() !== '');
            
            // Combine all code
            let allCode = '<!--- HTML --->\n' + html + '\n\n';
            
            if (scripts.length > 0) {
                allCode += '<!--- JavaScript --->\n' + scripts.join('\n\n') + '\n\n';
            }
            
            if (styles.length > 0) {
                allCode += '<!--- CSS --->\n' + styles.join('\n\n');
            }
            
            extractedCode.textContent = allCode;
        } catch (error) {
            extractedCode.textContent = `Error: ${error.message}\n\nThis might be due to same-origin policy restrictions.`;
        }
    }
    
    // Inject console logger into iframe
    function injectConsoleLogger() {
        try {
            const iframeWindow = websiteFrame.contentWindow;
            
            // Create script to inject
            const script = document.createElement('script');
            script.textContent = `
                (function() {
                    const originalConsole = {
                        log: console.log,
                        warn: console.warn,
                        error: console.error,
                        info: console.info
                    };
                    
                    function captureLog(type, args) {
                        const logData = {
                            type: type,
                            message: Array.from(args).map(arg => {
                                try {
                                    return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
                                } catch (e) {
                                    return String(arg);
                                }
                            }).join(' '),
                            timestamp: new Date().toISOString()
                        };
                        
                        window.parent.postMessage({
                            type: 'console-log',
                            data: logData
                        }, '*');
                        
                        return args;
                    }
                    
                    console.log = function() {
                        const args = captureLog('log', arguments);
                        return originalConsole.log.apply(console, args);
                    };
                    
                    console.warn = function() {
                        const args = captureLog('warn', arguments);
                        return originalConsole.warn.apply(console, args);
                    };
                    
                    console.error = function() {
                        const args = captureLog('error', arguments);
                        return originalConsole.error.apply(console, args);
                    };
                    
                    console.info = function() {
                        const args = captureLog('info', arguments);
                        return originalConsole.info.apply(console, args);
                    };
                })();
            `;
            
            if (iframeWindow.document.body) {
                iframeWindow.document.body.appendChild(script);
                consoleLogs.textContent = 'Console logger injected. Waiting for logs...';
            } else {
                consoleLogs.textContent = 'Could not inject console logger: no body element found.';
            }
        } catch (error) {
            consoleLogs.textContent = `Error injecting console logger: ${error.message}\n\nThis might be due to same-origin policy restrictions.`;
        }
    }
    
    // Receive messages from iframe
    function receiveMessage(event) {
        // For security, verify origin if needed
        // if (event.origin !== "https://websim.ai") return;
        
        if (event.data && event.data.type === 'console-log') {
            const logData = event.data.data;
            const logText = `[${logData.timestamp}] [${logData.type.toUpperCase()}] ${logData.message}`;
            
            capturedLogs.push(logText);
            consoleLogs.textContent = capturedLogs.join('\n');
        }
    }
    
    // Analyze with LLM
    async function analyzeWithLLM(content, type) {
        try {
            let prompt = '';
            
            if (type === 'code') {
                prompt = `Analyze the following code from a websim.ai project for potential bugs, issues, or improvements:\n\n${content}\n\nPlease identify any:\n1. Potential bugs or errors\n2. Performance issues\n3. Security concerns\n4. Code quality issues\n5. Suggested improvements`;
            } else if (type === 'logs') {
                prompt = `Analyze the following console logs from a websim.ai project for potential issues or errors:\n\n${content}\n\nPlease identify:\n1. Any errors or exceptions\n2. Warning patterns\n3. Potential performance issues indicated in the logs\n4. Suggestions for addressing the issues found`;
            }
            
            const completion = await websim.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "You are a code analysis expert specializing in identifying bugs, errors, and potential issues in web applications. Provide clear, concise analysis with actionable recommendations."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ]
            });
            
            return completion.content;
        } catch (error) {
            throw new Error(`LLM analysis failed: ${error.message}`);
        }
    }
    
    // Initialize
    extractedCode.textContent = 'No code extracted yet.';
    consoleLogs.textContent = 'No logs captured yet.';
    analysisResults.textContent = 'Load a website, extract code, and analyze it to see results.';
});

