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
    
    // Define CORS proxies to try
    const corsProxies = [
        {name: "CORS Anywhere", url: "https://cors-anywhere.herokuapp.com/"},
        {name: "AllOrigins", url: "https://api.allorigins.win/raw?url="},
        {name: "corsproxy.io", url: "https://corsproxy.io/?"},
        {name: "CORS.sh", url: "https://cors.sh/"},
        {name: "thingproxy", url: "https://thingproxy.freeboard.io/fetch/"}
    ];
    
    // Add global error handler to catch iframe errors
    window.addEventListener('error', function(event) {
        const errorMsg = `[${new Date().toISOString()}] [ERROR] ${event.message} (${event.filename}:${event.lineno})`;
        capturedLogs.push(errorMsg);
        updateConsoleLogs();
    });
    
    // Load website into iframe
    loadButton.addEventListener('click', function() {
        const url = websiteUrlInput.value.trim();
        if (url) {
            websiteFrame.src = url;
            capturedLogs = [];
            consoleLogs.textContent = 'Loading website...';
            capturedLogs.push(`[${new Date().toISOString()}] [INFO] Loading website in iframe: ${url}`);
            updateConsoleLogs();
            
            // Set up message listener for communication with the iframe
            window.addEventListener('message', receiveMessage, false);
            
            // Try to inject console logger when the iframe loads
            websiteFrame.onload = function() {
                capturedLogs.push(`[${new Date().toISOString()}] [INFO] Website loaded in iframe`);
                updateConsoleLogs();
                
                // Create a console logger proxy
                createConsoleLoggerProxy(url);
            };
        }
    });
    
    // Extract code from iframe
    extractButton.addEventListener('click', function() {
        try {
            const url = websiteUrlInput.value.trim();
            if (url) {
                extractedCode.textContent = 'Attempting to extract code...';
                extractCodeUsingCorsProxies(url);
            } else {
                extractedCode.textContent = 'Please enter a URL first.';
            }
        } catch (error) {
            extractedCode.textContent = `Error extracting code: ${error.message}`;
        }
    });
    
    // Analyze extracted code
    analyzeButton.addEventListener('click', async function() {
        const code = extractedCode.textContent;
        if (code && code !== 'No code extracted yet.' && !code.startsWith('Extracting code...') && !code.startsWith('Error:')) {
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
    
    // Function to try multiple CORS proxies until one works
    async function extractCodeUsingCorsProxies(url) {
        extractedCode.textContent = 'Trying to extract code using CORS proxies...';
        
        // First try direct iframe extraction
        try {
            const result = directIframeExtraction();
            if (result) {
                extractedCode.textContent = result;
                return;
            }
        } catch (error) {
            console.log("Direct iframe extraction failed, trying proxies...", error);
        }
        
        // Try each proxy in sequence
        for (let i = 0; i < corsProxies.length; i++) {
            const proxy = corsProxies[i];
            extractedCode.textContent = `Trying proxy ${i+1}/${corsProxies.length}: ${proxy.name}...`;
            
            try {
                const response = await fetch(proxy.url + url);
                if (!response.ok) throw new Error(`Proxy returned ${response.status}`);
                
                const html = await response.text();
                
                // Process the HTML
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                
                // Get HTML
                const processedHtml = doc.documentElement.outerHTML;
                
                // Get JS scripts
                const scripts = Array.from(doc.querySelectorAll('script'))
                    .map(script => script.innerHTML)
                    .filter(content => content.trim() !== '');
                
                // Get CSS styles
                const styles = Array.from(doc.querySelectorAll('style'))
                    .map(style => style.innerHTML)
                    .filter(content => content.trim() !== '');
                
                // Combine all code
                let allCode = `<!--- HTML (via ${proxy.name} proxy) --->\n` + processedHtml + '\n\n';
                
                if (scripts.length > 0) {
                    allCode += '<!--- JavaScript --->\n' + scripts.join('\n\n') + '\n\n';
                }
                
                if (styles.length > 0) {
                    allCode += '<!--- CSS --->\n' + styles.join('\n\n');
                }
                
                // Also try to get external CSS files
                const cssLinks = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'))
                    .map(link => link.getAttribute('href'))
                    .filter(href => href);
                
                if (cssLinks.length > 0) {
                    allCode += '\n\n<!--- External CSS files --->\n';
                    allCode += cssLinks.join('\n');
                }
                
                extractedCode.textContent = allCode;
                return; // Success, exit the function
            } catch (error) {
                console.log(`Proxy ${proxy.name} failed:`, error);
                // Continue to the next proxy
            }
        }
        
        // If all proxies failed
        extractedCode.textContent = 'Error: All CORS proxies failed. Unable to extract code. Consider manually inspecting the page in browser developer tools.';
    }
    
    // Function to try direct iframe extraction
    function directIframeExtraction() {
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
            let allCode = '<!--- HTML (direct access) --->\n' + html + '\n\n';
            
            if (scripts.length > 0) {
                allCode += '<!--- JavaScript --->\n' + scripts.join('\n\n') + '\n\n';
            }
            
            if (styles.length > 0) {
                allCode += '<!--- CSS --->\n' + styles.join('\n\n');
            }
            
            return allCode;
        } catch (error) {
            console.log("Direct iframe extraction error:", error);
            return null;
        }
    }

    // Create a console logger proxy iframe that can intercept logs
    async function createConsoleLoggerProxy(url) {
        capturedLogs.push(`[${new Date().toISOString()}] [INFO] Setting up console logger proxy...`);
        updateConsoleLogs();
        
        // Try each proxy in sequence for fetching content
        for (let i = 0; i < corsProxies.length; i++) {
            const proxy = corsProxies[i];
            try {
                capturedLogs.push(`[${new Date().toISOString()}] [INFO] Trying to fetch content via ${proxy.name}...`);
                updateConsoleLogs();
                
                // Fetch the content via proxy
                const response = await fetch(proxy.url + url);
                if (!response.ok) throw new Error(`Proxy returned ${response.status}`);
                
                const html = await response.text();
                
                // Create a hidden iframe with srcdoc to have control over the environment
                const loggerFrame = document.createElement('iframe');
                loggerFrame.style.display = 'none';
                loggerFrame.sandbox = 'allow-same-origin allow-scripts';
                document.body.appendChild(loggerFrame);
                
                // Create content for the srcdoc with our console logger injected
                const loggerFrameContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Console Logger Proxy</title>
                    <script>
                    // Setup message channel to parent
                    function sendLogToParent(type, message) {
                        window.parent.postMessage({
                            type: 'console-log',
                            data: {
                                type: type,
                                message: message,
                                timestamp: new Date().toISOString()
                            }
                        }, '*');
                    }
                    
                    // Override console methods
                    const originalConsole = {
                        log: console.log,
                        warn: console.warn,
                        error: console.error,
                        info: console.info
                    };
                    
                    console.log = function() {
                        const message = Array.from(arguments).map(a => String(a)).join(' ');
                        sendLogToParent('log', message);
                        return originalConsole.log.apply(console, arguments);
                    };
                    
                    console.warn = function() {
                        const message = Array.from(arguments).map(a => String(a)).join(' ');
                        sendLogToParent('warn', message);
                        return originalConsole.warn.apply(console, arguments);
                    };
                    
                    console.error = function() {
                        const message = Array.from(arguments).map(a => String(a)).join(' ');
                        sendLogToParent('error', message);
                        return originalConsole.error.apply(console, arguments);
                    };
                    
                    console.info = function() {
                        const message = Array.from(arguments).map(a => String(a)).join(' ');
                        sendLogToParent('info', message);
                        return originalConsole.info.apply(console, arguments);
                    };
                    
                    // Catch unhandled errors
                    window.addEventListener('error', function(event) {
                        sendLogToParent('error', 'UNHANDLED ERROR: ' + event.message + ' at ' + (event.filename || 'unknown') + ':' + (event.lineno || '?'));
                        event.preventDefault();
                    });
                    
                    // Notify that logger is ready
                    sendLogToParent('info', 'Console logger proxy initialized');
                    
                    // Load and execute the target page with console logging enabled
                    function loadContent() {
                        try {
                            // Get HTML content
                            const content = ${JSON.stringify(html)};
                            
                            // Create container to simulate the page environment
                            const container = document.createElement('div');
                            container.innerHTML = content;
                            
                            // Extract and execute scripts
                            const scripts = container.querySelectorAll('script');
                            scripts.forEach(script => {
                                try {
                                    if (script.src) {
                                        console.log('External script found:', script.src);
                                    } else if (script.textContent) {
                                        // Execute inline scripts in a try-catch
                                        try {
                                            console.log('Executing inline script...');
                                            eval(script.textContent);
                                        } catch (scriptError) {
                                            console.error('Error in script execution:', scriptError.message);
                                        }
                                    }
                                } catch (scriptExtractError) {
                                    console.error('Error processing script:', scriptExtractError.message);
                                }
                            });
                            
                            console.log('Content loaded and scripts processed');
                        } catch (contentError) {
                            console.error('Error loading content:', contentError.message);
                        }
                    }
                    
                    // Execute after the logger is ready
                    setTimeout(loadContent, 100);
                    </script>
                </head>
                <body>
                    <div id="console-logger-proxy">Console Logger Proxy</div>
                </body>
                </html>`;
                
                // Set the content and add to document
                loggerFrame.srcdoc = loggerFrameContent;
                
                capturedLogs.push(`[${new Date().toISOString()}] [INFO] Console logger proxy created via ${proxy.name}`);
                updateConsoleLogs();
                
                // Also attempt to monitor network activity
                setupNetworkMonitoring(url);
                
                return;
            } catch (error) {
                capturedLogs.push(`[${new Date().toISOString()}] [WARN] Proxy ${proxy.name} failed: ${error.message}`);
                updateConsoleLogs();
            }
        }
        
        capturedLogs.push(`[${new Date().toISOString()}] [WARN] All console logger proxy attempts failed. Limited log capture available.`);
        updateConsoleLogs();
        
        // Fallback to global error monitoring
        capturedLogs.push(`[${new Date().toISOString()}] [INFO] Falling back to global error monitoring only.`);
        updateConsoleLogs();
    }
    
    // Additional monitoring for network issues
    function setupNetworkMonitoring(url) {
        capturedLogs.push(`[${new Date().toISOString()}] [INFO] Setting up network monitoring...`);
        updateConsoleLogs();
        
        // Create an img tag to test if the site responds
        const testImg = new Image();
        testImg.onload = function() {
            capturedLogs.push(`[${new Date().toISOString()}] [INFO] Network test: site responds to image requests`);
            updateConsoleLogs();
        };
        testImg.onerror = function() {
            capturedLogs.push(`[${new Date().toISOString()}] [WARN] Network test: site blocks image requests or has no favicon`);
            updateConsoleLogs();
        };
        
        // Try to load the favicon or a small image from the site
        const faviconUrl = new URL('/favicon.ico', url).href;
        testImg.src = faviconUrl;
        
        // Try fetch with different modes
        checkFetchModes(url);
    }
    
    // Test fetch with different modes
    async function checkFetchModes(url) {
        const modes = ['cors', 'no-cors'];
        for (const mode of modes) {
            try {
                capturedLogs.push(`[${new Date().toISOString()}] [INFO] Testing fetch with mode: ${mode}`);
                updateConsoleLogs();
                
                const response = await fetch(url, { mode: mode });
                capturedLogs.push(`[${new Date().toISOString()}] [INFO] Fetch ${mode} succeeded with status: ${response.status}`);
                updateConsoleLogs();
            } catch (error) {
                capturedLogs.push(`[${new Date().toISOString()}] [WARN] Fetch ${mode} failed: ${error.message}`);
                updateConsoleLogs();
            }
        }
    }
    
    // Helper to update console logs display
    function updateConsoleLogs() {
        consoleLogs.textContent = capturedLogs.join('\n');
        // Auto-scroll to bottom
        consoleLogs.scrollTop = consoleLogs.scrollHeight;
    }
    
    // Receive messages from iframe
    function receiveMessage(event) {
        if (event.data && event.data.type === 'console-log') {
            const logData = event.data.data;
            const logText = `[${logData.timestamp}] [${logData.type.toUpperCase()}] ${logData.message}`;
            
            capturedLogs.push(logText);
            updateConsoleLogs();
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
    
    // Setup global monitoring for iframe errors
    const originalOnError = window.onerror;
    window.onerror = function(message, source, lineno, colno, error) {
        // Only log if it seems to be from the iframe
        if (source && (source.includes(websiteUrlInput.value) || source === 'iframe')) {
            const errorMsg = `[${new Date().toISOString()}] [ERROR] ${message} (${source}:${lineno})`;
            capturedLogs.push(errorMsg);
            updateConsoleLogs();
        }
        
        // Call the original handler if it exists
        if (originalOnError) return originalOnError(message, source, lineno, colno, error);
        return false;
    };
});