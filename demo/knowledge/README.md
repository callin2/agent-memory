# Knowledge Notes - Sticky Notes Demo

## What This Demo Shows

**Visual knowledge management** through colorful sticky notes:
- Quick capture of insights and learnings
- Tag-based filtering and organization
- Visual, fun interface inspired by real sticky notes
- Masonry-style responsive layout

## Quick Start

```bash
# Server should already be running
cd ../..
npm run dev

# Open the demo
open http://localhost:3456/demo/knowledge/index.html
```

## Features

### 📝 Visual Sticky Notes
- **5 colors**: Yellow, Pink, Blue, Green, Purple
- **Realistic design**: Push pin, gradient backgrounds, shadow effects
- **Hover animations**: Notes lift up when you hover over them
- **Masonry layout**: Responsive column-based layout

### 🏷️ Tag Filtering
- Click any tag to filter notes
- Shows tag counts in filter bar
- Visual feedback on active filters
- "All Notes" button to reset filter

### ➕ Create New Notes
- Floating "+" button (bottom-right)
- Modal form for creating notes
- Text area for content
- Tag input (comma separated)
- Color picker
- Instant save to database

### 📊 Stats
- Note count per tag
- Total notes display
- Creation timestamps

## API Endpoints Used

### GET /api/v1/knowledge/notes
Retrieve knowledge notes for a tenant.

**Query Parameters:**
- `tenant_id` (required): Tenant to fetch notes for
- `limit` (optional): Max notes to return (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:** Array of knowledge notes

### POST /api/v1/knowledge/notes
Create a new knowledge note.

**Request Body:**
```json
{
  "tenant_id": "default",
  "text": "What I learned today...",
  "tags": ["insight", "learning"],
  "with_whom": "User via Sticky Notes Demo"
}
```

**Response:** Created note object

## Database Schema

**Table:** `knowledge_notes`

| Column | Type | Description |
|--------|------|-------------|
| id | text | Unique note ID |
| tenant_id | text | Tenant identifier |
| text | text | Note content |
| with_whom | text | Who created the note |
| timestamp | timestamp | When note was created |
| tags | text[] | Array of tags |
| created_at | timestamp | Creation timestamp |

**Indexes:**
- Primary key on `id`
- GIN index on `tags` for fast tag filtering
- B-tree index on `(tenant_id, timestamp DESC)` for time-based queries

## Sample Notes

The demo includes existing knowledge notes:

1. **Capability Recognition** - About handling complex system design independently
2. **E2E Testing** - Complete handoff→startup flow validation
3. **Test Note** - Sample note for story generation

## Visual Design

### Color Scheme
- **Yellow** (#fde047) - General notes, default color
- **Pink** (#f9a8d4) - Personal insights
- **Blue** (#93c5fd) - Technical learnings
- **Green** (#86efac) - Success stories, achievements
- **Purple** (#d8b4fe) - Methodology, process improvements

### Typography
- Dark background (#111827)
- High contrast text on colored notes
- Small, readable font for note content
- Monospace font for code/technical content

### Animations
- Smooth transitions on hover (0.3s ease)
- Notes lift up (-4px translateY)
- Subtle rotation (1deg) for realism
- Enhanced shadow on hover

## How to Use

### 1. Browse Notes
- Open the demo
- See all notes in masonry layout
- Scroll to browse
- Hover over notes to see lift effect

### 2. Filter by Tags
- Click any tag on a note
- Or click tag buttons in filter bar
- Notes instantly filter
- Click "All Notes" to reset

### 3. Create New Note
1. Click **"+"** button (bottom-right)
2. Type your insight/learning
3. Add tags (optional, comma separated)
4. Pick a color
5. Click "Create Note"
6. Note instantly appears!

## Behind the Scenes

### Frontend
- **Framework:** Vanilla JavaScript
- **Styling:** Tailwind CSS
- **Layout:** CSS columns (masonry)
- **Icons:** Emojis for simplicity

### Backend
- **API:** Express.js routes
- **Database:** PostgreSQL with `knowledge_notes` table
- **Authentication:** None (public demo)
- **CORS:** Enabled for development

### Data Flow
1. Frontend fetches notes via GET `/api/v1/knowledge/notes`
2. PostgreSQL returns notes (ordered by timestamp DESC)
3. Frontend renders notes as sticky notes
4. User creates note via POST `/api/v1/knowledge/notes`
5. Note saved to database
6. Frontend reloads notes to show new note

## Why Sticky Notes?

**Traditional knowledge bases:**
- ✗ Boring lists and tables
- ✗ No visual hierarchy
- ✗ Hard to scan quickly
- ✗ Not fun to use

**Sticky notes approach:**
- ✓ Familiar metaphor (everyone uses sticky notes)
- ✓ Visual and colorful
- ✓ Easy to scan at a glance
- ✓ Fun and engaging
- ✓ Color coding for categorization

## Use Cases

**Perfect for:**
- Quick insight capture during meetings
- Parking lot ideas (things to discuss later)
- Daily standup notes
- Learning from experiments
- Design thinking sessions
- Brainstorming sessions

**Not ideal for:**
- Long-form documentation (use handoffs instead)
- Structured knowledge (use wiki instead)
- Collaborative editing (use Google Docs instead)

## Future Enhancements

- [ ] Search notes by content
- [ ] Edit existing notes
- [ ] Delete notes
- [ ] Drag to reorder notes
- [ ] Export notes as JSON/markdown
- [ ] Share notes via URL
- [ ] Color themes
- [ ] Note prioritization
- [ ] Due dates on notes
- [ ] Collaborative notes (multi-user)

## Technical Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript, Tailwind CSS
- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL 15+
- **API:** RESTful endpoints

## Related Files

- `demo/timeline/index.html` - Timeline Explorer demo
- `demo/chat/index.html` - Multi-Agent Chat demo
- `src/api/knowledge-routes.ts` - Knowledge API implementation
- `src/db/migrations/017_knowledge_notes.sql` - Database schema

---

Built with ❤️ using Thread's Memory System
