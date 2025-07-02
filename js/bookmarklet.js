// Contract Analysis Bookmarklet - Main JavaScript File
// This file should be hosted at: https://yoursite.com/bookmarklet.js
// Version: 1.0.0 - MVP

(function() {
    'use strict';
    
    console.log('🔍 Contract Analysis Bookmarklet Loading...');
    
    // ==========================================
    // CONFIGURATION
    // ==========================================
    
    const CONFIG = {
        // API Configuration - Update these for production
        apiEndpoint: 'https://api.legalforensics.com/v1/analyze',
        apiKey: 'your-api-key-here', // Or use token-based auth
        
        // Feature flags
        enablePDFAnalysis: true,
        enableTextAnalysis: true,
        enableMockMode: true, // Set to false for production
        
        // Limits
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxTextLength: 50000, // 50k characters
        minTextLength: 500, // Minimum text to consider
        minKeywordCount: 3, // Minimum contract keywords needed
        
        // UI Configuration
        zIndex: 10000,
        animationDuration: 300,
        
        // Supported file types
        supportedTypes: ['pdf', 'doc', 'docx'],
        
        // Contract detection keywords
        contractKeywords: [
            'agreement', 'contract', 'lease', 'rental', 'terms and conditions',
            'whereas', 'party', 'parties', 'covenant', 'hereby', 'witnesseth',
            'consideration', 'bind', 'binding', 'obligation', 'shall',
            'tenant', 'landlord', 'lessor', 'lessee', 'licensor', 'licensee',
            'purchase agreement', 'sale agreement', 'employment agreement',
            'non-disclosure', 'confidentiality', 'amendment', 'addendum'
        ]
    };
    
    // ==========================================
    // PREVENT MULTIPLE INSTANCES
    // ==========================================
    
    if (window.contractAnalyzer) {
        console.log('📖 Contract Analyzer already loaded - toggling interface');
        window.contractAnalyzer.toggle();
        return;
    }
    
    // ==========================================
    // UTILITY FUNCTIONS
    // ==========================================
    
    const Utils = {
        // Generate unique user token for tracking
        getUserToken() {
            let token = localStorage.getItem('contractAnalyzerToken');
            if (!token) {
                token = 'ca_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
                localStorage.setItem('contractAnalyzerToken', token);
                console.log('🆔 Generated new user token:', token);
            }
            return token;
        },
        
        // Log usage for analytics
        logUsage(action, data = {}) {
            const logData = {
                token: this.getUserToken(),
                action: action,
                url: window.location.href,
                timestamp: new Date().toISOString(),
                ...data
            };
            
            console.log('📊 Usage Log:', logData);
            
            // In production, send to your analytics endpoint
            if (!CONFIG.enableMockMode) {
                // fetch('/api/analytics', { method: 'POST', body: JSON.stringify(logData) });
            }
        },
        
        // Sanitize text for API
        sanitizeText(text) {
            return text
                .replace(/[\r\n\t]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, CONFIG.maxTextLength);
        },
        
        // Check if URL is accessible
        isUrlAccessible(url) {
            try {
                const urlObj = new URL(url, window.location.href);
                return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
            } catch {
                return false;
            }
        },
        
        // Format file size
        formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
    };
    
    // ==========================================
    // CONTRACT DETECTION ENGINE
    // ==========================================
    
    const ContractDetector = {
        // Main detection function
        detect() {
            console.log('🔍 Starting contract detection...');
            Utils.logUsage('detection_started');
            
            const startTime = Date.now();
            
            const results = {
                pdfs: CONFIG.enablePDFAnalysis ? this.detectPDFs() : [],
                textContent: CONFIG.enableTextAnalysis ? this.detectTextContent() : [],
                metadata: {
                    url: window.location.href,
                    title: document.title,
                    detectionTime: 0,
                    timestamp: new Date().toISOString()
                }
            };
            
            results.metadata.detectionTime = Date.now() - startTime;
            results.hasContracts = results.pdfs.length > 0 || results.textContent.length > 0;
            
            console.log('✅ Detection complete:', results);
            Utils.logUsage('detection_completed', {
                pdfs_found: results.pdfs.length,
                text_blocks_found: results.textContent.length,
                detection_time_ms: results.metadata.detectionTime
            });
            
            return results;
        },
        
        // Detect PDF documents
        detectPDFs() {
            console.log('📄 Detecting PDFs...');
            const pdfs = [];
            
            // PDF detection selectors
            const pdfSelectors = [
                'embed[src*=".pdf"], embed[src*=".PDF"]',
                'object[data*=".pdf"], object[data*=".PDF"]',
                'iframe[src*=".pdf"], iframe[src*=".PDF"]',
                'a[href*=".pdf"], a[href*=".PDF"]',
                'link[href*=".pdf"], link[href*=".PDF"]'
            ];
            
            pdfSelectors.forEach(selector => {
                try {
                    document.querySelectorAll(selector).forEach((el, index) => {
                        const url = el.src || el.data || el.href;
                        
                        if (url && url.toLowerCase().includes('.pdf') && Utils.isUrlAccessible(url)) {
                            const pdfData = {
                                id: `pdf_${pdfs.length}`,
                                type: 'pdf',
                                url: url,
                                element: el,
                                title: this.extractTitle(el),
                                selector: selector.split(',')[0],
                                size: el.getAttribute('data-size') || 'Unknown',
                                isVisible: this.isElementVisible(el)
                            };
                            
                            // Avoid duplicates
                            if (!pdfs.some(p => p.url === url)) {
                                pdfs.push(pdfData);
                                console.log('📄 PDF found:', pdfData);
                            }
                        }
                    });
                } catch (error) {
                    console.warn('⚠️ Error with selector:', selector, error);
                }
            });
            
            console.log(`📊 Total PDFs found: ${pdfs.length}`);
            return pdfs;
        },
        
        // Detect contract text content
        detectTextContent() {
            console.log('📝 Detecting contract text...');
            const textBlocks = [];
            
            try {
                // Get all text content from the page
                const allText = this.extractPageText();
                
                if (allText.length < CONFIG.minTextLength) {
                    console.log('❌ Page text too short:', allText.length, 'characters');
                    return textBlocks;
                }
                
                // Analyze text for contract characteristics
                const analysis = this.analyzeText(allText);
                
                if (analysis.keywordCount >= CONFIG.minKeywordCount) {
                    const textData = {
                        id: 'text_0',
                        type: 'text',
                        content: Utils.sanitizeText(allText),
                        ...analysis,
                        extractedAt: new Date().toISOString()
                    };
                    
                    textBlocks.push(textData);
                    console.log('📝 Contract text found:', textData);
                }
                
                // Also check for specific contract sections
                const sections = this.findContractSections();
                sections.forEach((section, index) => {
                    if (section.keywordCount >= CONFIG.minKeywordCount) {
                        textBlocks.push({
                            id: `section_${index}`,
                            type: 'text_section',
                            ...section
                        });
                    }
                });
                
            } catch (error) {
                console.error('❌ Error detecting text content:', error);
            }
            
            console.log(`📊 Total text blocks found: ${textBlocks.length}`);
            return textBlocks;
        },
        
        // Extract clean text from page
        extractPageText() {
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: (node) => {
                        const parent = node.parentElement;
                        if (!parent) return NodeFilter.FILTER_REJECT;
                        
                        const tagName = parent.tagName.toLowerCase();
                        const excludedTags = ['script', 'style', 'noscript', 'nav', 'header', 'footer'];
                        
                        return excludedTags.includes(tagName) ? 
                            NodeFilter.FILTER_REJECT : 
                            NodeFilter.FILTER_ACCEPT;
                    }
                },
                false
            );
            
            let textContent = '';
            let node;
            
            while (node = walker.nextNode()) {
                const text = node.textContent.trim();
                if (text.length > 10) { // Ignore very short text nodes
                    textContent += text + ' ';
                }
            }
            
            return textContent.trim();
        },
        
        // Analyze text for contract characteristics
        analyzeText(text) {
            const words = text.toLowerCase().split(/\s+/);
            const totalWords = words.length;
            
            // Count keyword occurrences
            let keywordCount = 0;
            const foundKeywords = [];
            
            CONFIG.contractKeywords.forEach(keyword => {
                const regex = new RegExp(keyword.toLowerCase(), 'g');
                const matches = text.toLowerCase().match(regex) || [];
                if (matches.length > 0) {
                    keywordCount += matches.length;
                    foundKeywords.push({
                        keyword: keyword,
                        count: matches.length
                    });
                }
            });
            
            // Calculate contract probability
            const keywordDensity = keywordCount / totalWords;
            const contractProbability = Math.min(keywordDensity * 100, 0.95);
            
            return {
                length: text.length,
                wordCount: totalWords,
                keywordCount: keywordCount,
                foundKeywords: foundKeywords,
                keywordDensity: keywordDensity,
                contractProbability: contractProbability,
                content: text.substring(0, CONFIG.maxTextLength)
            };
        },
        
        // Find specific contract sections
        findContractSections() {
            const sections = [];
            const sectionSelectors = [
                'div[class*="contract"]',
                'div[class*="agreement"]',
                'div[class*="terms"]',
                'section[class*="legal"]',
                '.contract-section',
                '.agreement-section',
                '.terms-section'
            ];
            
            sectionSelectors.forEach(selector => {
                try {
                    document.querySelectorAll(selector).forEach(element => {
                        const text = element.textContent.trim();
                        if (text.length > CONFIG.minTextLength) {
                            const analysis = this.analyzeText(text);
                            if (analysis.keywordCount >= CONFIG.minKeywordCount) {
                                sections.push({
                                    element: element,
                                    selector: selector,
                                    ...analysis
                                });
                            }
                        }
                    });
                } catch (error) {
                    console.warn('⚠️ Error with section selector:', selector, error);
                }
            });
            
            return sections;
        },
        
        // Helper functions
        extractTitle(element) {
            return element.title || 
                   element.getAttribute('alt') || 
                   element.textContent?.trim() || 
                   element.getAttribute('data-title') ||
                   'Document';
        },
        
        isElementVisible(element) {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            
            return rect.width > 0 && 
                   rect.height > 0 && 
                   style.display !== 'none' && 
                   style.visibility !== 'hidden' &&
                   style.opacity !== '0';
        }
    };
    
    // ==========================================
    // API CLIENT
    // ==========================================
    
    const APIClient = {
        async analyzeContract(contractData) {
            console.log('🚀 Starting contract analysis...');
            Utils.logUsage('analysis_started', { type: contractData.type });
            
            try {
                if (CONFIG.enableMockMode) {
                    return await this.mockAnalysis(contractData);
                } else {
                    return await this.realAnalysis(contractData);
                }
            } catch (error) {
                console.error('❌ Analysis failed:', error);
                Utils.logUsage('analysis_failed', { error: error.message });
                throw error;
            }
        },
        
        // Mock analysis for development/demo
        async mockAnalysis(contractData) {
            console.log('🎭 Running mock analysis...');
            
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
            
            const mockResponses = {
                pdf: {
                    summary: 'This PDF appears to be a rental lease agreement with standard residential terms. The document includes provisions for rent, security deposits, and tenant obligations.',
                    keyTerms: [
                        'Monthly Rent: $2,500 (due 1st of month)',
                        'Security Deposit: $2,500 (refundable)',
                        'Lease Term: 12 months',
                        'Late Fee: $50 (after 5th of month)',
                        'Pet Policy: No pets allowed'
                    ],
                    riskLevel: 'Medium',
                    riskFactors: ['Standard late fees', 'Security deposit equal to rent'],
                    confidence: 0.87,
                    documentType: 'Residential Lease Agreement'
                },
                text: {
                    summary: 'The detected text contains contract language typical of a service agreement or terms of use document. Key provisions relate to user obligations and service limitations.',
                    keyTerms: [
                        'Service Term: As specified in order',
                        'Payment Terms: Net 30 days',
                        'Cancellation: 30 days written notice',
                        'Liability: Limited to service fees',
                        'Governing Law: State of incorporation'
                    ],
                    riskLevel: 'Low',
                    riskFactors: ['Standard liability limitations'],
                    confidence: 0.73,
                    documentType: 'Service Agreement'
                }
            };
            
            const baseResponse = mockResponses[contractData.type] || mockResponses.text;
            
            const result = {
                success: true,
                analysis: {
                    ...baseResponse,
                    analyzedAt: new Date().toISOString(),
                    processingTime: '2.3s',
                    wordCount: contractData.wordCount || 1200,
                    pageCount: contractData.type === 'pdf' ? 3 : 1
                },
                metadata: {
                    apiVersion: '1.0.0',
                    model: 'contract-analyzer-v1',
                    tokensUsed: Math.floor(Math.random() * 1000) + 500
                }
            };
            
            console.log('✅ Mock analysis complete:', result);
            Utils.logUsage('analysis_completed', { 
                type: contractData.type,
                confidence: result.analysis.confidence 
            });
            
            return result;
        },
        
        // Real API analysis
        async realAnalysis(contractData) {
            console.log('🌐 Calling real API...');
            
            const requestData = {
                contract: contractData,
                token: Utils.getUserToken(),
                metadata: {
                    url: window.location.href,
                    timestamp: new Date().toISOString(),
                    userAgent: navigator.userAgent
                }
            };
            
            const response = await fetch(CONFIG.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.apiKey}`,
                    'X-Bookmarklet-Version': '1.0.0'
                },
                body: JSON.stringify(requestData)
            });
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status} - ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('✅ API analysis complete:', result);
            
            Utils.logUsage('analysis_completed', { 
                type: contractData.type,
                api_response: true 
            });
            
            return result;
        }
    };
    
    // ==========================================
    // USER INTERFACE
    // ==========================================
    
    const UI = {
        modal: null,
        
        // Create main modal
        createModal() {
            if (this.modal) {
                this.modal.remove();
            }
            
            this.modal = document.createElement('div');
            this.modal.id = 'contractAnalyzerModal';
            this.modal.innerHTML = `
                <div style="
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.6);
                    z-index: ${CONFIG.zIndex};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
                    backdrop-filter: blur(2px);
                    animation: fadeIn ${CONFIG.animationDuration}ms ease-out;
                ">
                    <div style="
                        background: white;
                        border-radius: 16px;
                        padding: 28px;
                        max-width: 700px;
                        width: 95%;
                        max-height: 85vh;
                        overflow-y: auto;
                        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                        position: relative;
                        animation: slideUp ${CONFIG.animationDuration}ms ease-out;
                    ">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                            <div>
                                <h2 style="margin: 0; color: #1e293b; font-size: 24px; font-weight: 600;">
                                    🔍 Contract Analysis
                                </h2>
                                <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;">
                                    Powered by Legal Forensics AI
                                </p>
                            </div>
                            <button id="closeModal" style="
                                background: #f1f5f9;
                                border: none;
                                width: 32px;
                                height: 32px;
                                border-radius: 8px;
                                font-size: 18px;
                                cursor: pointer;
                                color: #64748b;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                transition: all 0.2s;
                            " 
                            onmouseover="this.style.background='#e2e8f0'" 
                            onmouseout="this.style.background='#f1f5f9'">×</button>
                        </div>
                        <div id="modalContent">
                            <div style="text-align: center; padding: 40px 20px;">
                                <div style="
                                    width: 48px;
                                    height: 48px;
                                    border: 3px solid #3b82f6;
                                    border-top-color: transparent;
                                    border-radius: 50%;
                                    margin: 0 auto 20px;
                                    animation: spin 1s linear infinite;
                                "></div>
                                <h3 style="color: #1e293b; margin-bottom: 8px;">Scanning Page</h3>
                                <p style="color: #64748b; margin: 0;">Looking for contracts and legal documents...</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <style>
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    
                    @keyframes slideUp {
                        from { transform: translateY(20px); opacity: 0; }
                        to { transform: translateY(0); opacity: 1; }
                    }
                    
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                </style>
            `;
            
            document.body.appendChild(this.modal);
            
            // Event handlers
            this.modal.querySelector('#closeModal').onclick = () => this.close();
            this.modal.onclick = (e) => {
                if (e.target === this.modal) this.close();
            };
            
            // Keyboard handler
            document.addEventListener('keydown', this.handleKeydown);
            
            return this.modal;
        },
        
        // Show detection results
        showDetectionResults(detection) {
            const content = this.modal.querySelector('#modalContent');
            
            if (!detection.hasContracts) {
                content.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px;">
                        <div style="font-size: 64px; margin-bottom: 16px;">🔍</div>
                        <h3 style="color: #ef4444; margin-bottom: 8px;">No Contracts Found</h3>
                        <p style="color: #64748b; margin-bottom: 20px;">
                            This page doesn't appear to contain any contracts or legal documents.
                        </p>
                        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; text-align: left;">
                            <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 14px;">What we look for:</h4>
                            <ul style="margin: 0; padding-left: 16px; color: #64748b; font-size: 13px;">
                                <li>PDF documents (contracts, agreements, leases)</li>
                                <li>Text containing legal terms and contract language</li>
                                <li>Document sections with binding language</li>
                            </ul>
                        </div>
                    </div>
                `;
                return;
            }
            
            let html = '<div>';
            
            // PDF Results
            if (detection.pdfs.length > 0) {
                html += `
                    <div style="margin-bottom: 24px;">
                        <h3 style="color: #059669; margin-bottom: 16px; display: flex; align-items: center;">
                            📄 PDF Documents (${detection.pdfs.length})
                        </h3>
                `;
                
                detection.pdfs.forEach((pdf, index) => {
                    html += `
                        <div style="
                            background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
                            border: 1px solid #bbf7d0;
                            border-radius: 12px;
                            padding: 16px;
                            margin-bottom: 12px;
                            transition: transform 0.2s;
                        " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                                <div style="flex: 1;">
                                    <h4 style="margin: 0 0 4px 0; color: #1e293b; font-size: 16px;">
                                        ${pdf.title}
                                    </h4>
                                    <p style="margin: 0; color: #64748b; font-size: 13px; word-break: break-all;">
                                        ${pdf.url}
                                    </p>
                                    ${pdf.size !== 'Unknown' ? `<p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px;">Size: ${pdf.size}</p>` : ''}
                                </div>
                                <span style="
                                    background: ${pdf.isVisible ? '#10b981' : '#6b7280'};
                                    color: white;
                                    padding: 2px 6px;
                                    border-radius: 10px;
                                    font-size: 10px;
                                    margin-left: 8px;
                                ">${pdf.isVisible ? 'Visible' : 'Hidden'}</span>
                            </div>
                            <button onclick="window.analyzeDocument(${index}, 'pdf')" style="
                                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                                color: white;
                                border: none;
                                padding: 10px 16px;
                                border-radius: 8px;
                                cursor: pointer;
                                font-weight: 500;
                                font-size: 14px;
                                transition: all 0.2s;
                                box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
                            " 
                            onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px rgba(59, 130, 246, 0.4)'" 
                            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(59, 130, 246, 0.3)'">
                                🔍 Analyze PDF
                            </button>
                        </div>
                    `;
                });
                
                html += '</div>';
            }
            
            // Text Content Results
            if (detection.textContent.length > 0) {
                const text = detection.textContent[0];
                html += `
                    <div style="margin-bottom: 24px;">
                        <h3 style="color: #059669; margin-bottom: 16px; display: flex; align-items: center;">
                            📝 Contract Text Found
                        </h3>
                        <div style="
                            background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
                            border: 1px solid #bbf7d0;
                            border-radius: 12px;
                            padding: 16px;
                            margin-bottom: 12px;
                        ">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                                <div>
                                    <span style="color: #64748b; font-size: 13px;">Contract Keywords:</span>
                                    <div style="font-weight: 600; color: #1e293b; font-size: 18px;">${text.keywordCount}</div>
                                </div>
                                <div>
                                    <span style="color: #64748b; font-size: 13px;">Content Length:</span>
                                    <div style="font-weight: 600; color: #1e293b; font-size: 18px;">${text.length.toLocaleString()} chars</div>
                                </div>
                                <div>
                                    <span style="color: #64748b; font-size: 13px;">Word Count:</span>
                                    <div style="font-weight: 600; color: #1e293b; font-size: 18px;">${text.wordCount.toLocaleString()}</div>
                                </div>
                                <div>
                                    <span style="color: #64748b; font-size: 13px;">Confidence:</span>
                                    <div style="font-weight: 600; color: #1e293b; font-size: 18px;">${Math.round(text.contractProbability * 100)}%</div>
                                </div>
                            </div>
                            
                            ${text.foundKeywords.length > 0 ? `
                                <div style="margin-bottom: 16px;">
                                    <span style="color: #64748b; font-size: 13px; display: block; margin-bottom: 8px;">Top Keywords:</span>
                                    <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                        ${text.foundKeywords.slice(0, 6).map(kw => `
                                            <span style="
                                                background: #dbeafe;
                                                color: #1e40af;
                                                padding: 4px 8px;
                                                border-radius: 12px;
                                                font-size: 12px;
                                                font-weight: 500;
                                            ">${kw.keyword} (${kw.count})</span>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                            
                            <button onclick="window.analyzeText()" style="
                                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                                color: white;
                                border: none;
                                padding: 10px 16px;
                                border-radius: 8px;
                                cursor: pointer;
                                font-weight: 500;
                                font-size: 14px;
                                transition: all 0.2s;
                                box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
                            " 
                            onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px rgba(59, 130, 246, 0.4)'" 
                            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(59, 130, 246, 0.3)'">
                                🔍 Analyze Text
                            </button>
                        </div>
                    </div>
                `;
            }
            
            html += '</div>';
            content.innerHTML = html;
        },
        
        // Show analysis results
        showAnalysisResults(results) {
            const content = this.modal.querySelector('#modalContent');
            const analysis = results.analysis;
            
            content.innerHTML = `
                <div>
                    <div style="text-align: center; margin-bottom: 24px;">
                        <div style="
                            width: 64px;
                            height: 64px;
                            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            margin: 0 auto 16px;
                            font-size: 28px;
                        ">✅</div>
                        <h3 style="color: #059669; margin-bottom: 8px;">Analysis Complete</h3>
                        <p style="color: #64748b; margin: 0;">
                            Processed in ${analysis.processingTime} • ${analysis.confidence * 100}% confidence
                        </p>
                    </div>
                    
                    <div style="
                        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                        border-radius: 12px;
                        padding: 20px;
                        margin-bottom: 20px;
                    ">
                        <h4 style="color: #1e293b; margin: 0 0 12px 0; font-size: 16px;">📋 Document Summary</h4>
                        <p style="
                            color: #374151;
                            line-height: 1.6;
                            margin: 0;
                            font-size: 14px;
                        ">${analysis.summary}</p>
                        
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-top: 16px;">
                            <div style="text-align: center; padding: 8px;">
                                <div style="color: #64748b; font-size: 12px;">Document Type</div>
                                <div style="color: #1e293b; font-weight: 600; font-size: 14px;">${analysis.documentType}</div>
                            </div>
                            <div style="text-align: center; padding: 8px;">
                                <div style="color: #64748b; font-size: 12px;">Word Count</div>
                                <div style="color: #1e293b; font-weight: 600; font-size: 14px;">${analysis.wordCount.toLocaleString()}</div>
                            </div>
                            <div style="text-align: center; padding: 8px;">
                                <div style="color: #64748b; font-size: 12px;">Pages</div>
                                <div style="color: #1e293b; font-weight: 600; font-size: 14px;">${analysis.pageCount}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="
                        background: white;
                        border: 1px solid #e2e8f0;
                        border-radius: 12px;
                        padding: 20px;
                        margin-bottom: 20px;
                    ">
                        <h4 style="color: #1e293b; margin: 0 0 16px 0; font-size: 16px;">🔑 Key Terms & Provisions</h4>
                        <div style="space-y: 8px;">
                            ${analysis.keyTerms.map(term => `
                                <div style="
                                    display: flex;
                                    align-items: flex-start;
                                    padding: 12px;
                                    background: #f9fafb;
                                    border-radius: 8px;
                                    margin-bottom: 8px;
                                ">
                                    <span style="
                                        background: #3b82f6;
                                        color: white;
                                        width: 6px;
                                        height: 6px;
                                        border-radius: 50%;
                                        margin: 6px 12px 0 0;
                                        flex-shrink: 0;
                                    "></span>
                                    <span style="color: #374151; font-size: 14px; line-height: 1.5;">${term}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div style="
                        background: white;
                        border: 1px solid #e2e8f0;
                        border-radius: 12px;
                        padding: 20px;
                        margin-bottom: 20px;
                    ">
                        <h4 style="color: #1e293b; margin: 0 0 16px 0; font-size: 16px;">⚠️ Risk Assessment</h4>
                        
                        <div style="display: flex; align-items: center; margin-bottom: 16px;">
                            <span style="color: #64748b; margin-right: 12px;">Overall Risk Level:</span>
                            <span style="
                                background: ${this.getRiskColor(analysis.riskLevel)};
                                color: white;
                                padding: 6px 12px;
                                border-radius: 16px;
                                font-size: 13px;
                                font-weight: 500;
                            ">${analysis.riskLevel}</span>
                        </div>
                        
                        ${analysis.riskFactors.length > 0 ? `
                            <div>
                                <span style="color: #64748b; font-size: 13px; display: block; margin-bottom: 8px;">Risk Factors:</span>
                                ${analysis.riskFactors.map(factor => `
                                    <div style="
                                        display: flex;
                                        align-items: center;
                                        padding: 8px 12px;
                                        background: #fef3c7;
                                        border-left: 3px solid #f59e0b;
                                        border-radius: 0 6px 6px 0;
                                        margin-bottom: 6px;
                                    ">
                                        <span style="color: #92400e; font-size: 13px;">${factor}</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                    
                    <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 16px;
                        background: #f8fafc;
                        border-radius: 8px;
                        font-size: 12px;
                        color: #64748b;
                    ">
                        <div>
                            <div>Analyzed: ${new Date(analysis.analyzedAt).toLocaleString()}</div>
                            <div>Model: ${results.metadata.model} v${results.metadata.apiVersion}</div>
                        </div>
                        <div style="text-align: right;">
                            <div>Tokens Used: ${results.metadata.tokensUsed.toLocaleString()}</div>
                            <div>Confidence: ${Math.round(analysis.confidence * 100)}%</div>
                        </div>
                    </div>
                </div>
            `;
        },
        
        // Show loading state
        showLoading(message = 'Processing...') {
            const content = this.modal.querySelector('#modalContent');
            content.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="
                        width: 48px;
                        height: 48px;
                        border: 3px solid #3b82f6;
                        border-top-color: transparent;
                        border-radius: 50%;
                        margin: 0 auto 20px;
                        animation: spin 1s linear infinite;
                    "></div>
                    <h3 style="color: #1e293b; margin-bottom: 8px;">${message}</h3>
                    <p style="color: #64748b; margin: 0;">This may take a few moments...</p>
                </div>
            `;
        },
        
        // Show error state
        showError(error) {
            const content = this.modal.querySelector('#modalContent');
            content.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 64px; margin-bottom: 16px;">❌</div>
                    <h3 style="color: #ef4444; margin-bottom: 8px;">Analysis Failed</h3>
                    <p style="color: #64748b; margin-bottom: 20px;">
                        ${error.message || 'An unexpected error occurred while analyzing the contract.'}
                    </p>
                    <button onclick="window.contractAnalyzer.start()" style="
                        background: #3b82f6;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 500;
                    ">Try Again</button>
                </div>
            `;
        },
        
        // Utility functions
        getRiskColor(riskLevel) {
            const colors = {
                'Low': '#10b981',
                'Medium': '#f59e0b',
                'High': '#ef4444',
                'Critical': '#dc2626'
            };
            return colors[riskLevel] || colors.Medium;
        },
        
        handleKeydown(e) {
            if (e.key === 'Escape') {
                UI.close();
            }
        },
        
        close() {
            if (this.modal) {
                this.modal.style.animation = `fadeOut ${CONFIG.animationDuration}ms ease-out`;
                setTimeout(() => {
                    if (this.modal && this.modal.parentNode) {
                        this.modal.remove();
                        this.modal = null;
                    }
                }, CONFIG.animationDuration);
            }
            document.removeEventListener('keydown', this.handleKeydown);
            Utils.logUsage('ui_closed');
        }
    };
    
    // ==========================================
    // STATUS NOTIFICATIONS
    // ==========================================
    
    const StatusNotifications = {
        show(message, type = 'info', duration = 3000) {
            let indicator = document.getElementById('contractAnalyzerStatus');
            
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'contractAnalyzerStatus';
                indicator.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 12px 16px;
                    border-radius: 8px;
                    color: white;
                    font-weight: 500;
                    z-index: ${CONFIG.zIndex + 1};
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    backdrop-filter: blur(8px);
                    transition: all 0.3s ease;
                    transform: translateX(100%);
                    opacity: 0;
                `;
                document.body.appendChild(indicator);
            }
            
            const colors = {
                success: '#10b981',
                error: '#ef4444',
                info: '#3b82f6',
                warning: '#f59e0b'
            };
            
            indicator.textContent = message;
            indicator.style.background = colors[type] || colors.info;
            
            // Animate in
            requestAnimationFrame(() => {
                indicator.style.transform = 'translateX(0)';
                indicator.style.opacity = '1';
            });
            
            // Auto-hide
            clearTimeout(indicator.hideTimeout);
            indicator.hideTimeout = setTimeout(() => {
                indicator.style.transform = 'translateX(100%)';
                indicator.style.opacity = '0';
            }, duration);
            
            Utils.logUsage('notification_shown', { type, message });
        }
    };
    
    // ==========================================
    // GLOBAL FUNCTIONS (for button clicks)
    // ==========================================
    
    window.analyzeDocument = async function(index, type) {
        try {
            UI.showLoading('Analyzing document...');
            StatusNotifications.show('Starting document analysis...', 'info');
            
            const detection = window.contractAnalyzer.lastDetection;
            let contractData;
            
            if (type === 'pdf') {
                contractData = {
                    type: 'pdf',
                    url: detection.pdfs[index].url,
                    title: detection.pdfs[index].title,
                    id: detection.pdfs[index].id
                };
            }
            
            const results = await APIClient.analyzeContract(contractData);
            UI.showAnalysisResults(results);
            StatusNotifications.show('Document analysis completed!', 'success');
            
        } catch (error) {
            console.error('Analysis error:', error);
            UI.showError(error);
            StatusNotifications.show('Analysis failed. Please try again.', 'error');
        }
    };
    
    window.analyzeText = async function() {
        try {
            UI.showLoading('Analyzing contract text...');
            StatusNotifications.show('Processing contract text...', 'info');
            
            const detection = window.contractAnalyzer.lastDetection;
            const contractData = {
                type: 'text',
                content: detection.textContent[0].content,
                wordCount: detection.textContent[0].wordCount,
                keywordCount: detection.textContent[0].keywordCount,
                id: detection.textContent[0].id
            };
            
            const results = await APIClient.analyzeContract(contractData);
            UI.showAnalysisResults(results);
            StatusNotifications.show('Text analysis completed!', 'success');
            
        } catch (error) {
            console.error('Analysis error:', error);
            UI.showError(error);
            StatusNotifications.show('Analysis failed. Please try again.', 'error');
        }
    };
    
    // ==========================================
    // MAIN CONTROLLER
    // ==========================================
    
    window.contractAnalyzer = {
        version: '1.0.0',
        lastDetection: null,
        isActive: false,
        
        async start() {
            if (this.isActive) {
                console.log('📖 Contract Analyzer already running');
                return;
            }
            
            this.isActive = true;
            console.log('🚀 Starting Contract Analyzer...');
            Utils.logUsage('bookmarklet_started');
            
            try {
                StatusNotifications.show('Scanning page for contracts...', 'info');
                
                // Create and show modal
                UI.createModal();
                
                // Small delay to show loading state
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Detect contracts
                const detection = ContractDetector.detect();
                this.lastDetection = detection;
                
                // Show results
                UI.showDetectionResults(detection);
                
                if (detection.hasContracts) {
                    const message = `Found ${detection.pdfs.length} PDF${detection.pdfs.length !== 1 ? 's' : ''} and ${detection.textContent.length} text contract${detection.textContent.length !== 1 ? 's' : ''}`;
                    StatusNotifications.show(message, 'success');
                } else {
                    StatusNotifications.show('No contracts detected on this page', 'warning');
                }
                
            } catch (error) {
                console.error('❌ Contract Analyzer Error:', error);
                UI.showError(error);
                StatusNotifications.show('Error scanning page. Please try again.', 'error');
                Utils.logUsage('bookmarklet_error', { error: error.message });
            } finally {
                this.isActive = false;
            }
        },
        
        toggle() {
            const existing = document.getElementById('contractAnalyzerModal');
            if (existing) {
                UI.close();
                Utils.logUsage('bookmarklet_closed');
            } else {
                this.start();
            }
        },
        
        // Public API for developers
        getLastDetection() {
            return this.lastDetection;
        },
        
        getConfig() {
            return { ...CONFIG };
        },
        
        // Cleanup function
        destroy() {
            UI.close();
            const status = document.getElementById('contractAnalyzerStatus');
            if (status) status.remove();
            
            delete window.contractAnalyzer;
            delete window.analyzeDocument;
            delete window.analyzeText;
            
            Utils.logUsage('bookmarklet_destroyed');
        }
    };
    
    // ==========================================
    // AUTO-START
    // ==========================================
    
    // Auto-start the analyzer
    window.contractAnalyzer.start();
    
    // Log successful load
    console.log('✅ Contract Analysis Bookmarklet loaded successfully');
    console.log('📊 Version:', window.contractAnalyzer.version);
    console.log('🔧 Config:', CONFIG.enableMockMode ? 'Mock Mode' : 'Production Mode');
    
})();
