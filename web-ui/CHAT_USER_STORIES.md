# 💬 Chat Interface User Stories - Dialogue Format

**URL**: `http://172.30.1.77:5173/chat`
**Purpose**: Test conversational memory operations with full control over messages, sessions, and test data generation

---

## Table of Contents

1. [Story 1: First Visit - Session Creation](#story-1-first-visit---session-creation)
2. [Story 2: Sending a Simple Message](#story-2-sending-a-simple-message)
3. [Story 3: Using Scenario Generator (Batch Testing)](#story-3-using-scenario-generator-batch-testing)
4. [Story 4: Creating a Fresh Session](#story-4-creating-a-fresh-session)
5. [Story 5: Managing Multiple Sessions](#story-5-managing-multiple-sessions)
6. [Story 6: Understanding Message Display](#story-6-understanding-message-display)
7. [Story 7: Using Different Channels](#story-7-using-different-channels)
8. [Story 8: Understanding Sensitivity Levels](#story-8-understanding-sensitivity-levels)
9. [Story 9: Subject Tagging Strategy](#story-9-subject-tagging-strategy)
10. [Story 10: Full Testing Workflow](#story-10-full-testing-workflow)

---

## Story 1: First Visit - Session Creation

**User**: "I just opened `http://172.30.1.77:5173/chat` for the first time. What happens?"

**Web-UI**:
> "Welcome! 🎉 I'll automatically set up your first session:
>
> 1. **Loading session...** ⏳
> - I generate a unique session ID: `session-1234567890-abc7xyz`
> - I save it to your browser's localStorage so you'll return to the same session next time
> - Session ready! You can see 'Session ID: session-1...abc7xyz' in the header
>
> 2. **Ready to chat!** 💬
> - Your conversation area is ready on the left (2/3 width)
> - Your input panel is on the right (1/3 width)
> - I show '0 messages' - starting fresh!"

**User Actions**:
- ✅ Page loads automatically
- ✅ Session created without user input
- ✅ Session ID displayed in header

**What User Learns**:
- Sessions are automatic and persistent
- Session ID helps track conversations
- Interface is split into messages (left) and input (right)

---

## Story 2: Sending a Simple Message

**User**: "I want to send a test message 'hello world'"

**Web-UI**:
> "Perfect! Here's how to do it:
>
> 1. **Type your message** ✏️
> - I show a text area placeholder: 'Type your message here...'
> - Go ahead and type 'hello world'
>
> 2. **Choose visibility** (Channel)
> - I show a dropdown with options:
>   - **Public**: Anyone can see this message
>   - **Team**: Only internal team members
>   - **Private**: Only you
> - Hover over the dropdown and I explain: 'Choose who can see this message to control memory access and privacy'
>
> 3. **Choose sensitivity level**
> - I show options: None, Low, Medium, High, Secret
> - Hover to learn: 'Select how sensitive this memory is - higher sensitivity means stricter access controls'
>
> 4. **Add subject tags** (optional)
> - I show an input field: 'Add subject tag...'
> - Type tags like 'testing', 'demo' and press Enter
> - Hover to learn: 'Add subject tags to group related messages, making them easier to find and analyze later'
>
> 5. **Click Send** 📤
> - I send your message to the memory system
> - I save it with your session ID
> - It appears instantly in the messages panel on the left
> - Message counter updates: '1 message'"

**User Actions**:
1. Type message in textarea
2. Select channel (Public/Team/Private)
3. Select sensitivity level
4. Add optional subject tags
5. Click Send button

**What User Learns**:
- Messages are stored with metadata (channel, sensitivity, tags)
- Each message appears in real-time in the message list
- Subject tags help organize memories

---

## Story 3: Using Scenario Generator (Batch Testing)

**User**: "I don't want to type messages one by one. Can you generate test data?"

**Web-UI**:
> "Absolutely! Let me switch to **Scenario Generator** mode:
>
> 1. **Click 'Scenario' tab** 📋
> - I show two tabs: 'New Message' and 'Scenario'
> - Click 'Scenario' to switch modes
>
> 2. **Configure your test scenario** ⚙️
> - **Complexity slider**: 1-10 scale
>   - Hover: 'Complexity slider: X/10 - Adjust scenario complexity where 1 is simple and 10 is highly complex with intricate details'
>   - Drag to select how complex the conversation should be
>
> - **Scenario Length**: Choose from:
>   - Short (2 messages) - Quick testing
>   - Medium (4 messages) - Balanced conversation
>   - Long (6 messages) - Extended conversation
>   - Hover: 'Scenario Length selector - Choose how many messages to generate in the test scenario'
>
> - **Subject Tags**: Add tags like 'auth', 'testing', 'demo'
>   - Hover: 'Add subject tags - Generate messages tagged with these subjects for organized test data'
>
> 3. **Generate Scenario** 🎲
> - Click 'Generate Scenario' button
> - I create realistic test conversations based on your settings
> - Hover button: 'Generate Scenario - Create a realistic test conversation with messages using your configured settings'
>
> 4. **Review Generated Messages** 👀
> - I show all generated messages in a list
> - Each message shows:
>   - Actor (human/agent)
>   - Content preview
>   - Channel and sensitivity
>   - Subject tags
>
> 5. **Edit if needed** ✏️
> - Click edit button (pencil icon) on any message
> - Hover: 'Edit message - Click to modify this message content before sending'
> - Modify the text, click outside to save
>
> 6. **Remove unwanted messages** 🗑️
> - Click trash icon to remove
> - Hover: 'Remove message - Delete this message from the generated scenario'
>
> 7. **Send All Messages** 🚀
> - Click 'Send All Messages' button
> - Hover: 'Send All Messages - Upload all generated messages to the memory system to test batch operations'
> - I send them sequentially to the backend
> - Watch the message count increase as each is sent!"

**User Actions**:
1. Switch to Scenario tab
2. Configure complexity, length, and tags
3. Click Generate Scenario
4. Review and edit generated messages
5. Remove unwanted ones
6. Click Send All Messages

**What User Learns**:
- Scenario generator creates realistic test data
- Full control over complexity and length
- Can edit before sending
- Batch operations save time

---

## Story 4: Creating a Fresh Session

**User**: "I want to start over with a clean session"

**Web-UI**:
> "Easy! I'll help you start fresh:
>
> 1. **Click 'New Session' button** 🔄
> - It's in the top-right of the conversation card
> - Hover: 'Start a fresh session to test memory with clean state and no previous conversation history'
>
> 2. **Watch me reset** ✨
> - I show 'Creating...' with a spinner
> - I clear your current session from memory
> - I generate a brand new session ID
> - The message counter resets to '0 messages'
>
> 3. **Fresh start!** 🆕
> - Your old conversation is gone (but saved in the backend)
> - You can switch back to old sessions using the Session Manager dropdown
> - Ready for new testing!"

**User Actions**:
- Click New Session button (top-right)
- Wait 500ms for session creation
- New clean session ready

**What User Learns**:
- New sessions are isolated from old ones
- Old sessions are preserved in backend
- Quick way to reset test state

---

## Story 5: Managing Multiple Sessions

**User**: "How do I switch between different test sessions?"

**Web-UI**:
> "Use the **Session Manager** dropdown in the top-right:
>
> 1. **Click Session Manager dropdown** 📂
> - I show all your available sessions
> - Current session is highlighted
>
> 2. **Select a session** 👆
> - Click any session to switch to it
> - I load all messages from that session
> - The message counter updates
>
> 3. **View session details** ℹ️
> - Each session shows:
>   - Session ID (truncated)
>   - Number of messages
>   - Last activity timestamp
>
> This lets you:
> - Test different scenarios in isolation
> - Compare memory retrieval between sessions
> - Organize your testing workflow"

**User Actions**:
- Click Session Manager dropdown
- Select desired session from list
- View messages from that session

**What User Learns**:
- Multiple sessions can be managed
- Sessions persist in backend
- Easy switching between contexts

---

## Story 6: Understanding Message Display

**User**: "What do all the message details mean?"

**Web-UI**:
> "Each message card shows rich information:
>
> **Header Section:**
> - **Actor Name**: Who sent it (e.g., 'User', 'Agent')
>   - Hover: 'Actor: User - The person who sent this message'
>
> - **Channel Badge**: Visibility level
>   - Public (green) / Team (yellow) / Private (blue)
>   - Hover: 'Channel: Public - Indicates the visibility level of this message (visible to all)'
>
> - **Sensitivity Icon**: Access control level
>   - Icon + label (None/Low/Medium/High/Secret)
>   - Hover: 'Sensitivity: High - Higher sensitivity means stricter access controls'
>
> **Content Section:**
> - Message text in a colored bubble
> - If message is long (>300 chars), I show 'Show more' button
>   - Hover: 'Show more - Click to expand and read the complete message text'
>
> **Tags Section:**
> - Subject tags as #hashtags
> - Click any tag to filter (planned feature)
> - Hover: 'Subject tag: #testing - Click to find other messages related to this topic for better memory organization'
>
> **Timestamp:**
> - When the message was created
> - Hover for full date/time"

**User Actions**:
- Hover over any element to see explanation
- Click "Show more" for long messages
- View all metadata at a glance

**What User Learns**:
- Each message has rich metadata
- Color coding indicates different attributes
- Tooltips explain every detail

---

## Story 7: Using Different Channels

**User**: "When should I use Public vs Team vs Private?"

**Web-UI**:
> "Great question! Each channel controls who can access the memory:
>
> **🌐 Public Channel**
> - Use for: General conversations, demo data
> - Access: Anyone in your organization
> - Memory retrieval: All users can search and find
> - Tooltip explains: 'public - visible to all'
>
> **👥 Team Channel**
> - Use for: Internal discussions, team decisions
> - Access: Only your team members
> - Memory retrieval: Team-only searches
> - Tooltip explains: 'team - internal team only'
>
> **🔒 Private Channel**
> - Use for: Personal notes, sensitive data
> - Access: Only you
> - Memory retrieval: Your private searches only
> - Tooltip explains: 'private - restricted access'
>
> **Pro tip**: The channel affects who can retrieve the memory later via the ACB system!"

**User Actions**:
- Select appropriate channel before sending
- Consider who will need to retrieve this memory

**What User Learns**:
- Channels control visibility at retrieval time
- Three levels: Public, Team, Private
- Affects ACB (Active Context Bundle) retrieval

---

## Story 8: Understanding Sensitivity Levels

**User**: "What's the difference between sensitivity levels?"

**Web-UI**:
> "Sensitivity controls access restrictions:
>
> **⚪ None** (default)
> - No special restrictions
> - Use for: Test data, public info
>
> **🟢 Low**
> - Basic access logging
> - Use for: Non-sensitive internal discussions
>
> **🟡 Medium**
> - Enhanced access tracking
> - Use for: Important but not critical info
>
> **🟠 High**
> - Strict access controls
> - Use for: Sensitive business data
>
> **🔴 Secret**
> - Maximum security
> - Use for: Confidential information
>
> Higher sensitivity = More restrictions on who can access/retrieve the memory!"

**User Actions**:
- Select appropriate sensitivity for each message
- Consider data classification requirements

**What User Learns**:
- 5-level sensitivity system
- Affects retrieval permissions
- Higher = more restricted

---

## Story 9: Subject Tagging Strategy

**User**: "How should I use subject tags effectively?"

**Web-UI**:
> "Subject tags are powerful for organizing memories:
>
> **Why use tags?**
> - Group related conversations
> - Filter by topic during retrieval
> - Improve memory search accuracy
>
> **Tagging Strategy:**
>
> 1. **By Feature** 📦
>    - 'authentication', 'database', 'api', 'ui'
>
> 2. **By Project** 📁
>    - 'project-alpha', 'user-testing', 'demo'
>
> 3. **By Domain** 🎯
>    - 'planning', 'analysis', 'decision', 'review'
>
> 4. **By Context** 📝
>    - 'bug-123', 'experiment-1', 'meeting-notes'
>
> **Best Practices:**
> - Use 2-4 tags per message
> - Be consistent with tag names
> - Use lowercase with hyphens
> - Tags help the ACB system find related memories!"

**User Actions**:
- Add tags before sending message
- Type tag and press Enter to add multiple
- Be consistent with naming

**What User Learns**:
- Tags organize memories for retrieval
- Multiple tags per message
- Consistency is important

---

## Story 10: Full Testing Workflow

**User**: "Walk me through a complete testing session"

**Web-UI**:
> "Here's a complete workflow example:
>
> **Phase 1: Setup** 🏗️
> 1. Open chat page (auto-creates session)
> 2. Note your Session ID for reference
>
> **Phase 2: Manual Testing** ✍️
> 1. Click 'New Message' tab
> 2. Type: 'Testing authentication flow'
> 3. Select: Team channel, Medium sensitivity
> 4. Add tag: 'auth'
> 5. Click Send
> 6. See message appear with correct styling
>
> **Phase 3: Batch Testing** 🔄
> 1. Click 'Scenario' tab
> 2. Set complexity: 7/10
> 3. Select: Medium length (4 messages)
> 4. Add tag: 'auth-testing'
> 5. Click 'Generate Scenario'
> 6. Review generated messages
> 7. Edit any that don't fit
> 8. Click 'Send All Messages'
> 9. Watch message count go from 1 → 5
>
> **Phase 4: Switch Context** 🔄
> 1. Click 'New Session' button
> 2. New session created
> 3. Send messages for different feature
>
> **Phase 5: Retrieve Memories** 🔍
> 1. Go to Retrieval page
> 2. Enter your session ID
> 3. Search for 'auth'
> 4. See your tagged memories retrieved!
>
> **Result**: You've tested the full memory lifecycle!"

**User Actions**:
1. Send manual message with tags
2. Generate and send scenario
3. Create new session
4. Test retrieval

**What User Learns**:
- Complete end-to-end workflow
- Integration between Chat and Retrieval
- Tags power the search system

---

## Feature Summary Cards

At the bottom of the page, three info cards explain key features:

### 📦 Multi-Subject Tagging
- **Purpose**: Organize conversations with subject tags
- **Benefit**: Better memory retrieval and context management
- **Usage**: Add tags to messages before sending

### 🎲 Scenario Generation
- **Purpose**: Generate realistic test conversations
- **Configurable**: Complexity and length settings
- **Benefit**: Fast batch testing without manual typing

### 📂 Session Management
- **Purpose**: Multiple conversation sessions
- **Benefit**: Test different scenarios in isolation
- **Usage**: Switch between sessions via dropdown

---

## Quick Reference

### Tabs
- **New Message**: Manual message input with full control
- **Scenario**: Generate and send test data in bulk

### Controls
- **Send**: Send current message
- **New Session**: Create fresh session
- **Session Manager**: Switch between sessions

### Message Properties
- **Channel**: Public/Team/Private (visibility)
- **Sensitivity**: None/Low/Medium/High/Secret (access control)
- **Tags**: Subject labels for organization

### Keyboard Shortcuts
- **Enter**: Send message (in textarea)
- **Shift+Enter**: New line in textarea
- **Tab**: Switch between tabs

---

## Pro Tips 💡

1. **Use Scenario Generator** for quick test data setup
2. **Tag consistently** - helps with retrieval later
3. **Switch sessions** to test isolated scenarios
4. **Check tooltips** - every element explains itself
5. **Monitor sensitivity** - affects retrieval permissions

---

## Technical Details

- **Session Persistence**: localStorage
- **Message Storage**: Backend API via memoryService
- **Real-time Updates**: Messages appear instantly
- **Session Format**: `session-{timestamp}-{random}`
- **Max Session ID Display**: First 8 characters

---

## Related Pages

- **Retrieval** (`/retrieval`): Search and retrieve tagged memories
- **Visualization** (`/visualization`): View memory graphs
- **Metrics** (`/metrics`): Performance statistics

---

**Last Updated**: 2025-02-13
**Version**: 0.1.0
**Environment**: Development (http://172.30.1.77:5173)
