document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const websiteUrlInput = document.getElementById('websiteUrl');
    const loadButton = document.getElementById('loadButton');
    const extractButton = document.getElementById('extractButton');
    const analyzeButton = document.getElementById('analyzeButton');
    const analyzeLogsButton = document.getElementById('analyzeLogs');
    const refreshFrameButton = document.getElementById('refreshFrame');
    const websiteFrame = document.getElementById('websiteFrame');
    const analysisResults = document.getElementById('analysisResults');
    const extractedCode = document.getElementById('extractedCode');
    const consoleLogs = document.getElementById('consoleLogs');
    const currentUrlDisplay = document.getElementById('currentUrl');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const themeToggle = document.getElementById('themeToggle');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const toastCloseBtn = document.getElementById('toastClose');
    const historyList = document.getElementById('historyList');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const collapsibleHeaders = document.querySelectorAll('.collapsible');
    const copyAnalysisBtn = document.getElementById('copyAnalysis');
    const copyCodeBtn = document.getElementById('copyCode');
    const copyLogsBtn = document.getElementById('copyLogs');
    const clearAnalysisBtn = document.getElementById('clearAnalysis');
    const clearCodeBtn = document.getElementById('clearCode');
    const clearLogsBtn = document.getElementById('clearLogs');

    // Store logs
    let capturedLogs = [];
    let urlHistory = JSON.parse(localStorage.getItem('urlHistory') || '[]');

    // Define CORS proxies to try
    const corsProxies = [
        {name: "CORS Anywhere", url: "https://cors-anywhere.herokuapp.com/"},
        {name: "AllOrigins", url: "https://api.allorigins.win/raw?url="},
        {name: "corsproxy.io", url: "https://corsproxy.io/?"},
        {name: "CORS.sh", url: "https://cors.sh/"},
        {name: "thingproxy", url: "https://thingproxy.freeboard.io/fetch/"}
    ];

    // Initialize theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }

    // Initialize history
    updateHistoryList();

    // Tab functionality
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');

            // Remove active class from all tabs and panes
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));

            // Add active class to clicked tab and corresponding pane
            button.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });

    // Collapsible panels
    collapsibleHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const panel = header.closest('.panel');
            panel.classList.toggle('collapsed');
        });
    });

    // Theme toggle
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        themeToggle.innerHTML = isDarkMode ? 
            '<i class="fas fa-sun"></i>' : 
            '<i class="fas fa-moon"></i>';

        showToast(isDarkMode ? 'Dark mode enabled' : 'Light mode enabled');
    });

    // Copy buttons
    copyAnalysisBtn.addEventListener('click', () => copyToClipboard(analysisResults.textContent, 'Analysis'));
    copyCodeBtn.addEventListener('click', () => copyToClipboard(extractedCode.textContent, 'Code'));
    copyLogsBtn.addEventListener('click', () => copyToClipboard(consoleLogs.textContent, 'Logs'));

    // Clear buttons
    clearAnalysisBtn.addEventListener('click', () => {
        analysisResults.textContent = 'Results cleared. Load a website, extract code, and analyze it to see results.';
        showToast('Analysis results cleared');
    });

    clearCodeBtn.addEventListener('click', () => {
        extractedCode.textContent = 'No code extracted yet.';
        showToast('Extracted code cleared');
    });

    clearLogsBtn.addEventListener('click', () => {
        consoleLogs.textContent = 'No logs captured yet.';
        capturedLogs = [];
        showToast('Console logs cleared');
    });

    // Toast close button
    toastCloseBtn.addEventListener('click', () => {
        hideToast();
    });

    // Refresh iframe
    refreshFrameButton.addEventListener('click', () => {
        const currentSrc = websiteFrame.src;
        setLoadingState(true);
        websiteFrame.src = currentSrc;
    });

    // Load website into iframe
    loadButton.addEventListener('click', function() {
        const url = websiteUrlInput.value.trim();
        if (url) {
            setLoadingState(true);
            websiteFrame.src = url;
            currentUrlDisplay.textContent = url;
            capturedLogs = [];
            consoleLogs.textContent = 'Loading website...';

            // Add to history if it doesn't exist
            if (!urlHistory.includes(url)) {
                urlHistory.unshift(url);
                if (urlHistory.length > 10) urlHistory.pop(); // Keep only last 10 URLs
                localStorage.setItem('urlHistory', JSON.stringify(urlHistory));
                updateHistoryList();
            }

            // Set up message listener for communication with the iframe
            window.addEventListener('message', receiveMessage, false);

            // Inject console logger once the iframe is loaded
            websiteFrame.onload = function() {
                setLoadingState(false);
                injectConsoleLogger();
            };
        } else {
            showToast('Please enter a valid URL', 'error');
        }
    });

    // Extract code from iframe
    extractButton.addEventListener('click', function() {
        try {
            const url = websiteUrlInput.value.trim();
            if (url) {
                extractedCode.textContent = 'Attempting to extract code...';
                setTabActive('code');
                extractCodeUsingCorsProxies(url);
            } else {
                extractedCode.textContent = 'Please enter a URL first.';
                showToast('Please enter a URL first', 'error');
            }
        } catch (error) {
            extractedCode.textContent = `Error extracting code: ${error.message}`;
            showToast('Error extracting code', 'error');
        }
    });

    // Analyze extracted code
    analyzeButton.addEventListener('click', async function() {
        const code = extractedCode.textContent;
        if (code && code !== 'No code extracted yet.' && !code.startsWith('Extracting code...') && !code.startsWith('Error:')) {
            analysisResults.textContent = 'Analyzing code...';
            setTabActive('analysis');
            updateStatusIndicator('loading', 'Analyzing code...');

            try {
                const analysis = await analyzeWithLLM(code, 'code');
                analysisResults.textContent = analysis;
                updateStatusIndicator('success', 'Analysis complete');
                showToast('Code analysis complete');
            } catch (error) {
                analysisResults.textContent = `Error during analysis: ${error.message}`;
                updateStatusIndicator('error', 'Analysis failed');
                showToast('Analysis failed', 'error');
            }
        } else {
            analysisResults.textContent = 'Please extract code first.';
            showToast('Please extract code first', 'error');
        }
    });

    // Analyze console logs
    analyzeLogsButton.addEventListener('click', async function() {
        if (capturedLogs.length > 0) {
            analysisResults.textContent = 'Analyzing logs...';
            setTabActive('analysis');
            updateStatusIndicator('loading', 'Analyzing logs...');

            try {
                const logsText = capturedLogs.join('\n');
                const analysis = await analyzeWithLLM(logsText, 'logs');
                analysisResults.textContent = analysis;
                updateStatusIndicator('success', 'Analysis complete');
                showToast('Log analysis complete');
            } catch (error) {
                analysisResults.textContent = `Error during analysis: ${error.message}`;
                updateStatusIndicator('error', 'Analysis failed');
                showToast('Analysis failed', 'error');
            }
        } else {
            analysisResults.textContent = 'No logs captured yet.';
            showToast('No logs to analyze', 'warning');
        }
    });

    // Function to try multiple CORS proxies until one works
    async function extractCodeUsingCorsProxies(url) {
        updateStatusIndicator('loading', 'Extracting code...');
        extractedCode.textContent = 'Trying to extract code using CORS proxies...';

        // First try direct iframe extraction
        try {
            const result = directIframeExtraction();
            if (result) {
                extractedCode.textContent = result;
                updateStatusIndicator('success', 'Code extracted');
                showToast('Code extracted successfully');
                applyCodeHighlighting();
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
                updateStatusIndicator('success', 'Code extracted via proxy');
                showToast(`Code extracted via ${proxy.name}`);
                applyCodeHighlighting();
                return; // Success, exit the function
            } catch (error) {
                console.log(`Proxy ${proxy.name} failed:`, error);
                // Continue to the next proxy
            }
        }

        // If all proxies failed
        extractedCode.textContent = 'Error: All CORS proxies failed. Unable to extract code. Consider manually inspecting the page in browser developer tools.';
        updateStatusIndicator('error', 'Extraction failed');
        showToast('Code extraction failed', 'error');
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
                showToast('Console logger injected');
            } else {
                consoleLogs.textContent = 'Could not inject console logger: no body element found.';
                showToast('Could not inject console logger', 'warning');
            }
        } catch (error) {
            consoleLogs.textContent = `Error injecting console logger: ${error.message}\n\nThis might be due to same-origin policy restrictions.`;
            showToast('Console logger injection failed', 'error');
        }
    }

    // Receive messages from iframe
    function receiveMessage(event) {
        // For security, verify origin if needed
        // if (event.origin !== "https://websim.ai") return;

        if (event.data && event.data.type === 'console-log') {
            const logData = event.data.data;
            let logClass = '';

            switch(logData.type) {
                case 'error': logClass = 'log-error'; break;
                case 'warn': logClass = 'log-warn'; break;
                case 'info': logClass = 'log-info'; break;
                default: logClass = '';
            }

            const formattedTime = new Date(logData.timestamp).toLocaleTimeString();
            const logText = `[${formattedTime}] [${logData.type.toUpperCase()}] ${logData.message}`;

            capturedLogs.push(logText);

            // Format logs with color classes
            const formattedLogs = capturedLogs.map(log => {
                if (log.includes('[ERROR]')) return `<div class="log-error">${log}</div>`;
                if (log.includes('[WARN]')) return `<div class="log-warn">${log}</div>`;
                if (log.includes('[INFO]')) return `<div class="log-info">${log}</div>`;
                return `<div>${log}</div>`;
            }).join('');

            consoleLogs.innerHTML = formattedLogs;

            // If it's an error, automatically switch to logs tab
            if (logData.type === 'error') {
                showToast('New console error detected', 'error');
            }
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

    // Helper functions
    function setTabActive(tabId) {
        tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
        });

        tabPanes.forEach(pane => {
            pane.classList.toggle('active', pane.id === `${tabId}-tab`);
        });
    }

    function updateStatusIndicator(status, message) {
        const statusDot = loadingIndicator.querySelector('.status-dot');
        const statusText = loadingIndicator.querySelector('.status-text');

        statusDot.className = 'status-dot';
        if (status === 'loading') statusDot.classList.add('loading');
        if (status === 'error') statusDot.classList.add('error');

        statusText.textContent = message;
    }

    function setLoadingState(isLoading) {
        if (isLoading) {
            loadingOverlay.classList.add('active');
            updateStatusIndicator('loading', 'Loading website...');
        } else {
            loadingOverlay.classList.remove('active');
            updateStatusIndicator('success', 'Website loaded');
        }
    }

    function copyToClipboard(text, type) {
        navigator.clipboard.writeText(text)
            .then(() => {
                showToast(`${type} copied to clipboard`);
            })
            .catch(err => {
                showToast(`Failed to copy ${type}`, 'error');
                console.error('Failed to copy: ', err);
            });
    }

    function showToast(message, type = 'info') {
        // Clear existing timeout
        if (toast.timeoutId) {
            clearTimeout(toast.timeoutId);
        }

        // Set icon based on type
        const iconEl = toast.querySelector('.toast-icon i');
        iconEl.className = 'fas';

        switch(type) {
            case 'error':
                iconEl.classList.add('fa-exclamation-circle');
                iconEl.style.color = 'var(--danger-color)';
                break;
            case 'warning':
                iconEl.classList.add('fa-exclamation-triangle');
                iconEl.style.color = 'var(--warning-color)';
                break;
            case 'success':
                iconEl.classList.add('fa-check-circle');
                iconEl.style.color = 'var(--success-color)';
                break;
            default:
                iconEl.classList.add('fa-info-circle');
                iconEl.style.color = 'var(--primary-color)';
        }

        toastMessage.textContent = message;
        toast.classList.add('show');

        // Auto hide after 4 seconds
        toast.timeoutId = setTimeout(() => {
            hideToast();
        }, 4000);
    }

    function hideToast() {
        toast.classList.remove('show');
    }

    function updateHistoryList() {
        if (urlHistory.length === 0) {
            historyList.innerHTML = '<li class="empty-list">No history yet</li>';
            return;
        }

        historyList.innerHTML = urlHistory.map(url => `
            <li data-url="${url}">
                <i class="fas fa-globe"></i>
                <span>${url.length > 30 ? url.substring(0, 30) + '...' : url}</span>
            </li>
        `).join('');

        // Add click event to history items
        document.querySelectorAll('#historyList li[data-url]').forEach(item => {
            item.addEventListener('click', () => {
                const url = item.getAttribute('data-url');
                websiteUrlInput.value = url;
                loadButton.click();
            });
        });
    }

    function applyCodeHighlighting() {
        // This would work with highlight.js for syntax highlighting
        if (typeof hljs !== 'undefined') {
            document.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }
    }

    // Initialize
    extractedCode.textContent = 'No code extracted yet.';
    consoleLogs.textContent = 'No logs captured yet.';
    analysisResults.textContent = 'Load a website, extract code, and analyze it to see results.';
    updateStatusIndicator('success', 'Ready');
});