# Chat Interface Features

## Overview

The chat interface provides a comprehensive system for testing multi-subject conversations with memory operations, subject tagging, and AI scenario generation.

## Components Created

### 1. **Memory Service** (`web-ui/src/services/memory.ts`)

API client for memory operations:

- `recordEvent()` - POST events to backend
- `getEvents()` - Retrieve session events
- `buildACB()` - Build Active Context Bundle (future)
- `createSession()` - Create new conversation session
- `getSessions()` - List all sessions
- `getSession()` - Get specific session
- `deleteSession()` - Delete a session

### 2. **Chat Types** (`web-ui/src/types/chat.ts`)

TypeScript interfaces for:

- `Channel` - private, public, team, agent
- `Sensitivity` - none, low, high, secret
- `ActorKind` - human, agent, system
- `MemoryEvent` - Full event structure
- `RecordEventRequest` - API request format
- `Session` - Session metadata
- `GeneratedMessage` - Scenario generation output
- `ScenarioGenerationParams` - Generation parameters

### 3. **SubjectTagger** (`web-ui/src/components/SubjectTagger.tsx`)

Interactive tag management component:

- Add/remove subject tags
- Tag suggestions (technical, design, feature-request, bug, etc.)
- Maximum tag limit (default: 10)
- Keyboard shortcuts (Enter to add, Backspace to remove)
- Visual tag badges with remove buttons

**Usage:**
```tsx
<SubjectTagger
  tags={tags}
  onTagsChange={setTags}
  placeholder="Add subject tags..."
  maxTags={10}
/>
```

### 4. **MessageInput** (`web-ui/src/components/MessageInput.tsx`)

Full-featured message composition:

- Auto-resize textarea (min 120px height)
- Channel selector (private, public, team, agent)
- Sensitivity selector (none, low, high, secret)
- Subject tagger integration
- Character counter (max 5000)
- Keyboard shortcuts (Enter to send, Shift+Enter for newline)
- Send validation with loading state

**Usage:**
```tsx
<MessageInput
  onSend={handleSend}
  disabled={isLoading}
  placeholder="Type your message..."
  minLength={1}
  maxLength={5000}
  defaultChannel="public"
  defaultSensitivity="none"
/>
```

### 5. **MessageList** (`web-ui/src/components/MessageList.tsx`)

Chat bubble display with:

- Human vs Agent message styling
- Channel badges (private, public, team, agent)
- Sensitivity indicators with icons
- Subject tags display
- Timestamp formatting (date + time)
- Long message expansion (300+ chars)
- Auto-scroll to latest message
- Scroll-aware auto-scroll toggle
- Empty state message

**Usage:**
```tsx
<MessageList
  messages={events}
  className="custom-classes"
/>
```

### 6. **ScenarioGenerator** (`web-ui/src/components/ScenarioGenerator.tsx`)

AI scenario generation for testing:

- Subject tag selection
- Complexity slider (1-10)
- Length selector (short/medium/long)
- Predefined scenario templates
- Editable generated messages
- Remove individual messages
- "Send All" batch sending
- Loading states during generation

**Predefined Scenarios:**
- **Short** (2 messages) - Quick Q&A
- **Medium** (4 messages) - Technical discussion
- **Long** (6 messages) - Architecture planning

**Usage:**
```tsx
<ScenarioGenerator
  onGenerate={customLLMGenerator} // Optional
  onSendAll={handleBatchSend}
  disabled={isLoading}
/>
```

### 7. **ChatInterface** (`web-ui/src/components/ChatInterface.tsx`)

Main chat orchestration component:

- Message list display
- New message input tab
- Scenario generator tab
- Session-based message loading
- Real-time message updates
- Message count display
- Loading states

**Usage:**
```tsx
<ChatInterface
  sessionId="session-123"
  actorName="User"
/>
```

### 8. **Chat Page** (`web-ui/src/pages/Chat.tsx`)

Complete chat page with:

- Session management integration
- LocalStorage session persistence
- Auto-create default session
- Session switching
- Feature info cards
- Loading and empty states

## Usage Examples

### Basic Chat Flow

1. **Navigate to Chat Page**
   ```bash
   # After starting the frontend
   http://localhost:5173/chat
   ```

2. **Send a Message**
   - Type message in textarea
   - Select channel (default: public)
   - Select sensitivity (default: none)
   - Add subject tags (e.g., "technical", "feature-request")
   - Press Enter or click "Send Message"

3. **View Messages**
   - Messages appear in chat bubble format
   - Human messages align right (primary color)
   - Agent messages align left (muted color)
   - Auto-scroll to latest message

### Scenario Generation Flow

1. **Generate Test Scenario**
   - Click "Scenario" tab
   - Add subject tags via main input first
   - Adjust complexity slider (1-10)
   - Select length (short/medium/long)
   - Click "Generate Scenario"

2. **Review Generated Messages**
   - Preview all generated messages
   - Edit individual messages if needed
   - Remove unwanted messages
   - View actor, channel, and tags for each

3. **Send All Messages**
   - Click "Send All Messages"
   - Messages sent sequentially to backend
   - Chat updates in real-time
   - Session message count updates

### Session Management

1. **Create New Session**
   - Click "Sessions" button
   - Click "New Session"
   - Enter session name
   - Session auto-selected

2. **Switch Sessions**
   - Click "Sessions" button
   - Click on session card
   - Dialog closes and loads session

3. **Delete Session**
   - Click "Sessions" button
   - Click trash icon on session
   - Cannot delete active session

## API Integration

### Record Event
```typescript
await memoryService.recordEvent(
  'session-123',
  'public',
  { kind: 'human', name: 'User' },
  'message',
  { text: 'Hello, world!' },
  'none',
  ['technical', 'greeting']
)
```

### Get Events
```typescript
const events = await memoryService.getEvents('session-123')
```

### Create Session
```typescript
const session = await memoryService.createSession('Product Planning')
```

## Testing Checklist

- [ ] Message sending with all channels
- [ ] Message sending with all sensitivity levels
- [ ] Subject tag addition/removal
- [ ] Long message expansion
- [ ] Auto-scroll behavior
- [ ] Scenario generation (short/medium/long)
- [ ] Generated message editing
- [ ] Batch send all messages
- [ ] Session creation
- [ ] Session switching
- [ ] Session deletion
- [ ] Persistence across page reloads

## Accessibility Features

- Full keyboard navigation support
- ARIA labels on interactive elements
- Screen reader compatible
- Focus management in dialogs
- Semantic HTML structure
- High contrast sensitivity indicators

## Performance Optimizations

- React.memo for message bubbles
- Lazy loading with React 19 suspense
- Virtual scrolling for large message lists (future)
- Debounced auto-resize textarea
- Optimized re-render with useCallback

## Future Enhancements

1. **LLM Integration**
   - Replace predefined scenarios with LLM generation
   - Use `/api/v1/acb/build` for context-aware generation
   - Support custom prompts

2. **Real-time Updates**
   - WebSocket integration for live message streaming
   - Multi-user session support
   - Typing indicators

3. **Advanced Features**
   - Message search and filtering
   - Message editing and deletion
   - Message reactions
   - File attachments
   - Voice input

4. **Analytics**
   - Message statistics dashboard
   - Subject tag frequency analysis
   - Sensitivity distribution charts
   - Session activity timelines

## File Structure

```
web-ui/src/
├── components/
│   ├── ChatInterface.tsx       # Main chat orchestration
│   ├── MessageInput.tsx         # Message composition
│   ├── MessageList.tsx          # Message display
│   ├── SubjectTagger.tsx        # Tag management
│   ├── ScenarioGenerator.tsx     # Test scenario generation
│   └── SessionManager.tsx       # Session CRUD
├── services/
│   └── memory.ts               # Memory API client
├── types/
│   └── chat.ts                 # Chat type definitions
└── pages/
    └── Chat.tsx                 # Chat page component
```

## Configuration

### Environment Variables
```bash
# .env
VITE_API_URL=http://localhost:3456
```

### Tailwind Customization
The components use Tailwind CSS with shadcn/ui design tokens for consistent styling.

## Troubleshooting

**Messages not appearing:**
- Check backend API is running
- Verify `VITE_API_URL` is correct
- Check browser console for errors
- Verify session ID is valid

**Scenario generation not working:**
- Ensure subject tags are added first
- Check browser console for errors
- Try different length options
- Clear browser cache

**Session management issues:**
- Verify localStorage is enabled
- Check backend API endpoints
- Review network requests in DevTools

---

Created: 2026-02-13
Version: 1.0.0
