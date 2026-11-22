export const EVENT_FORM = {
  id: 'event-register',
  label: 'Event Logs',
  description: 'Capture an event and save it to the selected timeline.',
  submitLabel: 'Save event',
  destinations: [
    { id: 'prashant', label: 'Prashant', detail: 'First spreadsheet · Sheet 3' },
    { id: 'khyati', label: 'Khyati', detail: 'First spreadsheet · Sheet 2' },
    { id: 'family', label: 'Family', detail: 'First spreadsheet · Sheet 1' },
    { id: 'others', label: 'Others', detail: 'Second spreadsheet' },
  ],
  fields: [
    { column: 'Event Name', label: 'Event name', type: 'text', required: true, placeholder: 'e.g. Goa Family Vacation', span: 2 },
    { column: 'Photos / Videos Link', label: 'Photos or videos link', type: 'url', placeholder: 'https://drive.google.com/…', span: 2 },
    { column: 'Event Category', label: 'Event category', type: 'choice', required: true, options: ['Family', 'Travel', 'Birthday', 'Celebration', 'Relationship', 'Health', 'Education', 'Career', 'Finance', 'Spiritual', 'Personal', 'Shaguns', 'Gifts', 'Other'] },
    { column: 'Event Type', label: 'Event type', type: 'choice', control: 'chips', chipTone: 'type', required: true, defaultValue: 'Personal', options: ['Personal', 'Family', 'Social', 'Professional'] },
    { column: 'Event Status', label: 'Event status', type: 'choice', control: 'chips', chipTone: 'status', required: true, defaultValue: 'Completed', options: ['Planned', 'Ongoing', 'Completed', 'Cancelled'] },
    { column: 'Event Dates', label: 'Event dates', type: 'date-range', required: true, startColumn: 'Start Date', endColumn: 'End Date', span: 2 },
    { column: 'Location', label: 'Location', type: 'location', options: ['Surendranagar', 'Ahmedabad', 'Zobala', 'Pune'], placeholder: 'e.g. Ahmedabad, Pune', span: 2 },
    { column: 'People Attended', label: 'People attended', type: 'people', options: ['Sahil', 'Umang', 'Mummy'], placeholder: 'Search or add a person' },
    { column: 'Emotional Importance', label: 'Emotional importance', type: 'choice', control: 'chips', chipTone: 'importance', options: ['Low', 'Medium', 'High', 'Life-Changing'] },
    { column: 'Amount Spent (₹)', label: 'Amount spent', type: 'currency', min: 0, placeholder: '0' },
    { column: 'Memories / Highlights', label: 'Memories & highlights', type: 'textarea', placeholder: 'Most memorable moments', span: 2 },
    { column: 'Lessons Learned', label: 'Lessons learned', type: 'textarea', placeholder: 'What this experience taught you', span: 2 },
    { column: 'Event Description', label: 'Event description', type: 'textarea', placeholder: 'What happened? Add useful context.', span: 2 },
    { column: 'Tags', label: 'Tags', type: 'tags', placeholder: 'Type a tag, then press Enter or comma', span: 2 },
  ],
};

export const LOAN_FORM = {
  id: 'loan-register',
  label: 'Loan Register',
  description: 'Record a transfer and its current repayment position.',
  submitLabel: 'Save loan',
  fields: [
    { column: 'Date Transferred', label: 'Date transferred', type: 'date', required: true, defaultValue: 'today' },
    { column: 'Sender', label: 'Sender', type: 'person', required: true, options: ['Mummy', 'Alpesh', 'Prashant', 'Darshita', 'Moira Nexus', 'Chotila Farm', 'Prangadh Farm'], placeholder: 'Select or add a sender' },
    { column: 'Receiver', label: 'Receiver', type: 'person', required: true, options: ['Mummy', 'Alpesh', 'Prashant', 'Darshita', 'Moira Nexus', 'Chotila Farm', 'Prangadh Farm'], placeholder: 'Select or add a receiver' },
    { column: 'Loan Type', label: 'Loan type', type: 'choice', required: true, defaultValue: 'Personal', options: ['Personal', 'Home', 'Vehicle', 'Business', 'Education', 'Medical', 'Property related', 'Lawyer/Legal', 'Other'] },
    { column: 'Status', label: 'Status', type: 'choice', required: true, defaultValue: 'Active', options: ['Active', 'Partially Paid', 'Paid', 'Overdue'] },
    { column: 'Total Amount', label: 'Total amount', type: 'currency', required: true, min: 0, placeholder: '0' },
    { column: 'Amount Paid', label: 'Amount paid', type: 'currency', min: 0, defaultValue: '0', placeholder: '0' },
    { column: 'Outstanding', label: 'Outstanding', type: 'calculated-currency', span: 2 },
    { column: 'Amount Paid On', label: 'Amount paid on', type: 'date' },
  ],
};

export const APP_NAVIGATION = [
  { id: EVENT_FORM.id, label: EVENT_FORM.label, icon: '◷' },
  { id: LOAN_FORM.id, label: LOAN_FORM.label, icon: '₹' },
];

export const FORMS = {
  [EVENT_FORM.id]: EVENT_FORM,
  [LOAN_FORM.id]: LOAN_FORM,
};
