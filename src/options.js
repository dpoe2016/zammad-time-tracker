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
  const userIdsInput = document.getElementById('userIds');
  const apiSaveBtn = document.getElementById('apiSaveBtn');
  const statusMessage = document.getElementById('statusMessage');
  const dashboardRefreshSecInput = document.getElementById(
    'dashboardRefreshSec'
  );
  const showTooltipsInput = document.getElementById('showTooltips');
  const tooltipDelayInput = document.getElementById('tooltipDelay');

  // Update UI language if translations are available
  if (typeof updateUILanguage === 'function') {
    updateUILanguage();
  } else {
    console.log('Translations not available, using default text');
  }

  // Load saved settings and populate user dropdown
  loadApiSettingsAndUsers();

  // Add event listener for save button
  apiSaveBtn.addEventListener('click', saveApiSettings);

  /**
   * Load API settings and then populate the user dropdown
   */
  async function loadApiSettingsAndUsers() {
    await loadApiSettings();
    // If API is configured, populate the user dropdown
    if (apiBaseUrlInput.value && apiTokenInput.value) {
      populateUserDropdown();
    }
  }

  /**
   * Populate the user dropdown with admins and agents
   */
  async function populateUserDropdown() {
    userIdsInput.innerHTML = '<option>Loading users...</option>';
    try {
      // Initialize API if it hasn't been already
      if (!zammadApi.isInitialized()) {
        zammadApi.init(apiBaseUrlInput.value, apiTokenInput.value);
      }
      const users = await zammadApi.getAdminAndAgentUsers();
      userIdsInput.innerHTML = ''; // Clear loading message

      users
        .sort((a, b) => a.firstname.localeCompare(b.firstname))
        .forEach((user) => {
          const option = document.createElement('option');
          option.value = user.id;
          option.textContent = `${user.firstname} ${user.lastname}`;
          userIdsInput.appendChild(option);
        });

      // After populating, re-apply the saved selections
      await loadApiSettings();
    } catch (error) {
      console.error('Error populating user dropdown:', error);
      userIdsInput.innerHTML = '<option>Error loading users</option>';
    }
  }

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

      if (settings.userIds) {
        const selectedIds = settings.userIds.split(',');
        Array.from(userIdsInput.options).forEach((option) => {
          if (selectedIds.includes(option.value)) {
            option.selected = true;
          }
        });
      }

      if (typeof settings.dashboardRefreshSec !== 'undefined') {
        dashboardRefreshSecInput.value = settings.dashboardRefreshSec;
      }

      // Load tooltip setting (default to true if not set)
      showTooltipsInput.checked = settings.showTooltips !== false;

      // Load tooltip delay setting (default to 2000ms if not set)
      if (typeof settings.tooltipDelay !== 'undefined') {
        tooltipDelayInput.value = settings.tooltipDelay;
      } else {
        tooltipDelayInput.value = 2000; // Default to 2000ms
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
      const selectedUserIds = Array.from(userIdsInput.selectedOptions).map(
        (option) => option.value
      );
      const userIds = selectedUserIds.join(',');
      const dashboardRefreshSecRaw = dashboardRefreshSecInput.value.trim();
      const dashboardRefreshSec =
        dashboardRefreshSecRaw === ''
          ? undefined
          : Math.max(0, parseInt(dashboardRefreshSecRaw, 10) || 0);

      const tooltipDelayRaw = tooltipDelayInput.value.trim();
      const tooltipDelay = tooltipDelayRaw === ''
        ? 2000
        : Math.max(0, Math.min(10000, parseInt(tooltipDelayRaw, 10) || 2000));

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
      const settings = {
        baseUrl,
        token,
        userIds,
        showTooltips: showTooltipsInput.checked,
        tooltipDelay: tooltipDelay
      };
      if (typeof dashboardRefreshSec !== 'undefined') {
        settings.dashboardRefreshSec = dashboardRefreshSec;
      }

      // Save to storage
      await chrome.storage.local.set({ zammadApiSettings: settings });

      // Initialize API if available
      if (typeof zammadApi !== 'undefined' && zammadApi.init) {
        zammadApi.init(baseUrl, token);
        console.log('API initialized with new settings');
      }

      // ADD THIS: Force refresh API with new settings
      if (typeof zammadApi !== 'undefined' && zammadApi.forceRefreshSettings) {
        await zammadApi.forceRefreshSettings();
        console.log('API refreshed with new token');
      }

      console.log('API settings saved');
      showStatus('Settings saved successfully', 'success');

      // Re-populate the user dropdown with the new settings
      populateUserDropdown();
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
      document.getElementById('extensionTitle').textContent =
        t('extension_title');
      document.getElementById('subtitle').textContent = t('options_title');
      document.getElementById('apiSettingsTitle').textContent =
        t('api_settings_title');
      document.getElementById('apiBaseUrlLabel').textContent =
        t('api_base_url');
      document.getElementById('apiTokenLabel').textContent = t('api_token');
      document.getElementById('userIdsLabel').textContent =
        t('user_ids_label') || 'Filter User IDs';
      const dashRefLabel = document.getElementById('dashboardRefreshSecLabel');
      if (dashRefLabel)
        dashRefLabel.textContent =
          t('dashboard_refresh_interval') || 'Dashboard Auto Refresh (seconds)';
      document.getElementById('showTooltipsLabel').textContent =
        t('show_tooltips_label') || 'Show ticket tooltips on dashboard';
      document.getElementById('tooltipDelayLabel').textContent =
        t('tooltip_delay_label') || 'Tooltip delay (milliseconds)';
      document.getElementById('apiSaveBtn').textContent = t('api_save');
    }
  } catch (error) {
    console.error('Error updating UI language:', error);
  }
}