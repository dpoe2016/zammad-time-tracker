// Options page for Zammad Timetracking Extension
// Handles loading and saving API settings

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the options page
    initOptionsPage();
});

// Initialize the options page
function initOptionsPage() {
    console.log('Options page initialized');
    
    // Get UI elements
    const apiBaseUrlInput = document.getElementById('apiBaseUrl');
    const apiTokenInput = document.getElementById('apiToken');
    const apiSaveBtn = document.getElementById('apiSaveBtn');
    const statusMessage = document.getElementById('statusMessage');
    
    // Update UI language if translations are available
    if (typeof updateUILanguage === 'function') {
        updateUILanguage();
    } else {
        console.log('Translations not available, using default text');
    }
    
    // Load saved settings
    loadApiSettings();
    
    // Add event listener for save button
    apiSaveBtn.addEventListener('click', saveApiSettings);
    
    /**
     * Load API settings from storage
     */
    async function loadApiSettings() {
        try {
            console.log('Loading API settings');
            
            // Get settings from storage
            const result = await chrome.storage.local.get(['zammadApiSettings']);
            const settings = result.zammadApiSettings || {};
            
            // Populate form fields
            if (settings.baseUrl) {
                apiBaseUrlInput.value = settings.baseUrl;
            }
            
            if (settings.token) {
                apiTokenInput.value = settings.token;
            }
            
            console.log('API settings loaded');
        } catch (error) {
            console.error('Error loading API settings:', error);
            showStatus('Error loading settings: ' + error.message, 'error');
        }
    }
    
    /**
     * Save API settings to storage
     */
    async function saveApiSettings() {
        try {
            const baseUrl = apiBaseUrlInput.value.trim();
            const token = apiTokenInput.value.trim();
            
            // Validate inputs
            if (!baseUrl) {
                showStatus('Base URL is required', 'error');
                return;
            }
            
            if (!token) {
                showStatus('API Token is required', 'error');
                return;
            }
            
            // Create settings object
            const settings = { baseUrl, token };
            
            // Save to storage
            await chrome.storage.local.set({ zammadApiSettings: settings });
            
            // Initialize API if available
            if (typeof zammadApi !== 'undefined' && zammadApi.init) {
                zammadApi.init(baseUrl, token);
                console.log('API initialized with new settings');
            }
            
            console.log('API settings saved');
            showStatus('Settings saved successfully', 'success');
        } catch (error) {
            console.error('Error saving API settings:', error);
            showStatus('Error saving settings: ' + error.message, 'error');
        }
    }
    
    /**
     * Show status message
     * @param {string} message - The message to display
     * @param {string} type - The type of message ('success' or 'error')
     */
    function showStatus(message, type = 'success') {
        statusMessage.textContent = message;
        statusMessage.className = 'status-message ' + type;
        
        // Hide message after 5 seconds
        setTimeout(() => {
            statusMessage.className = 'status-message';
        }, 5000);
    }
}

// Function to update UI language - will be called if translations.js is loaded
function updateUILanguage() {
    try {
        // Update static UI elements if translation function exists
        if (typeof t === 'function') {
            document.getElementById('extensionTitle').textContent = t('extension_title');
            document.getElementById('subtitle').textContent = t('options_title');
            document.getElementById('apiSettingsTitle').textContent = t('api_settings_title');
            document.getElementById('apiBaseUrlLabel').textContent = t('api_base_url');
            document.getElementById('apiTokenLabel').textContent = t('api_token');
            document.getElementById('apiSaveBtn').textContent = t('api_save');
        }
    } catch (error) {
        console.error('Error updating UI language:', error);
    }
}