# Zammad Timetracking Extension - Flow Chart

This document provides a visual representation of the data flow and component interactions in the Zammad Timetracking Extension.

## Component Overview

The extension consists of the following main components:

1. **Popup UI** (popup.js, popup.html) - The user interface that appears when clicking the extension icon
2. **Background Script** (background.js) - Manages the extension's state and handles notifications
3. **Content Script** (content.js) - Interacts with the Zammad webpage
4. **API Service** (api.js) - Communicates with the Zammad API
5. **Storage** - Chrome's local storage for persisting state

## Flow Charts

### Main Process Flow

```mermaid
flowchart TD
    A[User clicks extension icon] --> B[Popup UI opens]
    B --> C{Is a Zammad ticket page?}
    C -->|No| D[Show error message]
    C -->|Yes| E[Load ticket information]
    E --> F{Is tracking active?}
    F -->|Yes| G[Show tracking status]
    F -->|No| H[Show Start button]
    
    H --> I[User clicks Start]
    I --> J[Start time tracking]
    J --> K[Update UI]
    K --> L[Notify background script]
    L --> M[Update extension icon]
    M --> N[Show notification]
    
    G --> O[User clicks Stop]
    O --> P[Stop time tracking]
    P --> Q[Calculate duration]
    Q --> R[Try auto-submit]
    R --> S[Update UI with result]
    S --> T[Notify background script]
    T --> U[Reset extension icon]
    U --> V[Show notification]
```

### Time Tracking Start Process

```mermaid
sequenceDiagram
    participant User
    participant Popup as Popup UI
    participant Background as Background Script
    participant Content as Content Script
    participant Storage as Chrome Storage
    participant API as Zammad API
    
    User->>Popup: Click Start button
    Popup->>Popup: Check if Zammad page
    Popup->>Content: Inject content script if needed
    Popup->>Content: Get ticket information
    Content-->>Popup: Return ticket ID and details
    Popup->>Content: Start tracking
    Content-->>Popup: Confirm tracking started
    
    Popup->>Storage: Save tracking state
    Popup->>Popup: Start timer
    Popup->>Popup: Update UI
    
    Popup->>Background: Send trackingStarted message
    Background->>Background: Set badge and icon
    Background->>User: Show notification
    
    Note over Popup: Popup closes after 2 seconds
```

### Time Tracking Stop Process

```mermaid
sequenceDiagram
    participant User
    participant Popup as Popup UI
    participant Background as Background Script
    participant Content as Content Script
    participant Storage as Chrome Storage
    participant API as Zammad API
    
    User->>Popup: Click Stop button
    Popup->>Popup: Calculate duration
    Popup->>Popup: Update UI
    Popup->>Popup: Stop timer
    
    Popup->>Content: Stop tracking
    Content-->>Popup: Confirm tracking stopped
    
    Popup->>Storage: Remove tracking state
    
    Popup->>Popup: Try auto-submit
    
    alt API initialized
        Popup->>API: Submit time entry
        API-->>Popup: Return success/failure
    else API not initialized or failed
        Popup->>Content: Submit time via UI
        Content-->>Popup: Return success/failure
    end
    
    Popup->>Popup: Show result message
    
    Popup->>Background: Send trackingStopped message
    Background->>Background: Clear badge and reset icon
    Background->>User: Show notification
    
    Note over Popup: Popup closes after 3 seconds
```

### Auto-Submit Process

```mermaid
flowchart TD
    A[Try auto-submit] --> B{Is API initialized?}
    B -->|Yes| C[Try API submission]
    B -->|No| F[Skip to UI method]
    
    C --> D{API submission successful?}
    D -->|Yes| E[Return success]
    D -->|No| F[Try UI submission]
    
    F --> G[Send submitTime message to content script]
    G --> H{UI submission successful?}
    H -->|Yes| I[Return success]
    H -->|No| J[Return failure]
```

### Component Interaction Diagram

```mermaid
flowchart TD
    User[User] <--> Popup[Popup UI]
    Popup <--> Background[Background Script]
    Popup <--> Content[Content Script]
    Popup <--> API[Zammad API]
    Popup <--> Storage[Chrome Storage]
    
    Background <--> User
    Content <--> API
    Content <--> Zammad[Zammad Webpage]
    
    subgraph "Chrome Extension"
        Popup
        Background
        Content
        Storage
    end
    
    subgraph "External"
        API
        Zammad
    end
```

## Data Flow

### Storage Data

The extension uses Chrome's local storage to persist the following data:

1. **zammadTrackingState** - Information about the current tracking session:
   - isTracking: boolean
   - startTime: ISO date string
   - ticketId: string
   - title: string
   - timeSpent: number (minutes)
   - url: string

2. **zammadSettings** - User preferences:
   - notifications: boolean
   - autoSubmit: boolean
   - language: string ('de' or 'en')

3. **zammadApiSettings** - API configuration:
   - baseUrl: string
   - token: string

### Message Types

The extension uses message passing for communication between components:

1. **From Popup to Background:**
   - trackingStarted: {ticketId, startTime}
   - trackingStopped: {ticketId, title, duration, success}

2. **From Popup to Content:**
   - getTicketInfo: {}
   - startTracking: {}
   - stopTracking: {}
   - submitTime: {duration, ticketId}

3. **From Content to Background:**
   - trackingStarted: {ticketId}
   - trackingStopped: {ticketId, duration, success}

## Legend

- **Rectangles**: Actions or states
- **Diamonds**: Decision points
- **Arrows**: Flow direction
- **Participants**: Components in sequence diagrams
- **Notes**: Additional information