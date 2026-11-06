// Choice fields intentionally start without options. Add master values to the
// `options` arrays when they are ready; the UI then becomes a select control.
export const EVENT_FORM = {
  id: 'event-register',
  destinations: [
    { id: 'prashant', label: 'Prashant', detail: 'First spreadsheet · Sheet 3' },
    { id: 'khyati', label: 'Khyati', detail: 'First spreadsheet · Sheet 2' },
    { id: 'family', label: 'Family', detail: 'First spreadsheet · Sheet 1' },
    { id: 'others', label: 'Others', detail: 'Second spreadsheet' },
  ],
  fields: [
    { column: 'Event Name', label: 'Event name', type: 'text', required: true, placeholder: 'e.g. Goa Family Vacation', span: 2 },
    { column: 'Photos / Videos Link', label: 'Photos or videos link', type: 'url', placeholder: 'https://drive.google.com/…', span: 2 },
    { column: 'Event Category', label: 'Event category', type: 'choice', required: true, options: ['Family', 'Travel', 'Birthday', 'Celebration', 'Relationship', 'Health', 'Education', 'Career', 'Finance', 'Spiritual', 'Personal', 'Other'] },
    { column: 'Event Type', label: 'Event type', type: 'choice', control: 'chips', chipTone: 'type', required: true, options: ['Personal', 'Family', 'Social', 'Professional'] },
    { column: 'Event Status', label: 'Event status', type: 'choice', control: 'chips', chipTone: 'status', required: true, options: ['Planned', 'Ongoing', 'Completed', 'Cancelled'] },
    { column: 'Event Dates', label: 'Event dates', type: 'date-range', required: true, startColumn: 'Start Date', endColumn: 'End Date', span: 2 },
    { column: 'Location', label: 'Location', type: 'text', placeholder: 'City, state, country, or venue', span: 2 },
    { column: 'People Attended', label: 'People attended', type: 'people', options: ['Sahil', 'Umang', 'Mummy'], placeholder: 'Search or add a person' },
    { column: 'Emotional Importance', label: 'Emotional importance', type: 'choice', control: 'chips', chipTone: 'importance', options: ['Low', 'Medium', 'High', 'Life-Changing'] },
    { column: 'Amount Spent (₹)', label: 'Amount spent', type: 'currency', min: 0, placeholder: '0' },
    { column: 'Memories / Highlights', label: 'Memories & highlights', type: 'textarea', placeholder: 'Most memorable moments', span: 2 },
    { column: 'Lessons Learned', label: 'Lessons learned', type: 'textarea', placeholder: 'What this experience taught you', span: 2 },
    { column: 'Event Description', label: 'Event description', type: 'textarea', placeholder: 'What happened? Add useful context.', span: 2 },
    { column: 'Tags', label: 'Tags', type: 'tags', placeholder: 'Type a tag, then press Enter or comma', span: 2 },
  ],
};
