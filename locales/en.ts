import type { TranslationDict } from './zh';

export const en: TranslationDict = {
  // Common
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.export': 'Export',
  'common.import': 'Import',
  'common.save': 'Save',
  'common.create': 'Create',
  'common.close': 'Close',
  'common.loading': 'Loading...',

  // Homepage
  'home.hero.line1': 'Design Diagrams',
  'home.hero.line2': 'with Natural Language',
  'home.hero.subtitle': 'Describe your idea, AI instantly generates professional diagrams',
  'home.editor': 'Editor',
  'home.history': 'History',
  'home.settings': 'Settings',
  'home.enterEditor': 'Enter Editor',
  'home.recent': 'Recent',
  'home.imageGenerated': 'Image Generated',

  // Quick templates
  'home.template.microservice': 'Microservice Architecture',
  'home.template.login': 'User Login Flow',
  'home.template.er': 'ER Data Model',
  'home.template.deploy': 'System Deployment',
  'home.template.mindmap': 'Mind Map',

  // Prompt box
  'prompt.placeholder': 'Describe the diagram you want to create...',
  'prompt.placeholderAttachment': 'Additional instructions (optional)...',
  'prompt.generate': 'Generate',
  'prompt.generating': 'Generating...',
  'prompt.attachments': 'Attachments',
  'prompt.uploadFile': 'Upload File',
  'prompt.uploadImage': 'Upload Image',
  'prompt.dragDrop': 'Drop files or images here',
  'prompt.imageCount': 'images',
  'prompt.fileCount': 'files',

  // Editor
  'editor.loading': 'Loading editor...',
  'editor.configReminder': 'Configuration Reminder',
  'editor.pleaseConfigLLM': 'Please configure your LLM provider first',
  'editor.generateFailed': 'Failed to generate code',
  'editor.requestError': 'Invalid request. Please check your input.',
  'editor.apiKeyError': 'API key is invalid or has insufficient permissions. Please check your configuration.',
  'editor.rateLimit': 'Too many requests. Please try again later.',
  'editor.serverError': 'Server error. Please try again later.',
  'editor.requestFailed': 'Request failed',
  'editor.streamParseError': 'Stream parse error: ',
  'editor.networkError': 'Network connection failed. Please check your connection.',
  'editor.imageUploadGenerated': 'Generated from image',
  'editor.layoutOptimize': 'Auto Layout',
  'editor.layoutOptimizing': 'Optimizing layout...',
  'editor.beautifyChart': 'Beautify Chart',
  'editor.beautifying': 'Beautifying...',
  'editor.generateNode': 'Generate Node',
  'editor.describeNode': 'Describe the node to add',

  // AI Copilot Panel
  'copilot.expandPanel': 'Expand Panel',
  'copilot.aiChat': 'AI Chat',
  'copilot.export': 'Export',
  'copilot.backHome': 'Back to Home',
  'copilot.newConversation': 'New Conversation',
  'copilot.aiChartAssistant': 'AI Chart Assistant',
  'copilot.describeChart': 'Describe the diagram you want to create',
  'copilot.continueDescribe': 'Continue describing the diagram...',
  'copilot.characters': 'characters',
  'copilot.uploadFile': 'Upload File',
  'copilot.uploadImage': 'Upload Image',
  'copilot.generating': 'Generating',
  'copilot.send': 'Send',
  'copilot.generate': 'Generate',
  'copilot.config': 'Config',

  // Bottom Context Panel
  'panel.generatedCode': 'Generated Code',
  'panel.aiExplanation': 'AI Explanation',
  'panel.versionCompare': 'Version Diff',
  'panel.logs': 'Logs',
  'panel.expandPanel': 'Expand Context Panel',
  'panel.aiExplanationEmpty': 'AI explanation will appear after generating a chart',
  'panel.versionCompareSoon': 'Version comparison coming soon',
  'panel.noLogs': 'No logs',
  'panel.codeWillAppear': 'Generated code will appear here',

  // Code Editor
  'codeEditor.generatedCode': 'Generated Code',
  'codeEditor.clear': 'Clear',
  'codeEditor.optimizeLayout': 'Optimize Layout',
  'codeEditor.applyToCanvas': 'Apply to Canvas',

  // Config Manager
  'config.title': 'Configuration',
  'config.new': 'New Config',
  'config.edit': 'Edit Config',
  'config.search': 'Search configs...',
  'config.noMatch': 'No matching configurations found',
  'config.noConfig': 'No configurations yet. Click "New Config" to create one.',
  'config.active': 'Active',
  'config.model': 'Model',
  'config.modelPrefix': 'Model:',
  'config.setActive': 'Set Active',
  'config.testConnection': 'Test Connection',
  'config.clone': 'Clone',
  'config.configName': 'Config Name',
  'config.configNamePlaceholder': 'e.g., My OpenAI',
  'config.description': 'Description',
  'config.descriptionPlaceholder': 'Configuration description (optional)',
  'config.providerType': 'Provider Type',
  'config.baseUrl': 'Base URL',
  'config.apiKey': 'API Key',
  'config.loadingModels': 'Loading models...',
  'config.loadModels': 'Load Available Models',
  'config.selectFromList': 'Select from list',
  'config.manualInput': 'Manual input',
  'config.modelPlaceholder': 'e.g., gpt-4, claude-3-opus',
  'config.confirmDelete': 'Confirm Delete',
  'config.confirmDeleteMsg': 'Are you sure you want to delete this configuration? This action cannot be undone.',
  'config.deleteSuccess': 'Deleted',
  'config.deleteSuccessMsg': 'Configuration deleted successfully',
  'config.cloneSuffix': ' (Copy)',
  'config.importSuccess': 'Import Successful',
  'config.imported': 'Successfully imported',
  'config.importedCount': 'configurations',
  'config.loadFailed': 'Failed to load configuration: ',
  'config.deleteFailed': 'Failed to delete configuration: ',
  'config.cloneFailed': 'Failed to clone configuration: ',
  'config.switchFailed': 'Failed to switch configuration: ',
  'config.testSuccess': 'Connection test successful',
  'config.testFailed': 'Connection test failed',
  'config.saveFailed': 'Failed to save configuration: ',
  'config.exportFailed': 'Failed to export configuration: ',
  'config.importFailed': 'Failed to import configuration: ',
  'config.fillRequired': 'Please fill in provider type, base URL, and API key first',
  'config.loadModelFailed': 'Failed to load models',
  'config.fillAllRequired': 'Please fill in all required fields',

  // History
  'history.title': 'History',
  'history.clearAll': 'Clear All',
  'history.empty': 'No history records',
  'history.confirmDelete': 'Confirm Delete',
  'history.confirmDeleteMsg': 'Are you sure you want to delete this history record?',
  'history.confirmClear': 'Confirm Clear',
  'history.confirmClearMsg': 'Are you sure you want to clear all history records? This action cannot be undone.',
  'history.apply': 'Apply',
  'history.modelPrefix': 'Model:',

  // Conversation List
  'conversation.list': 'Conversations',
  'conversation.new': 'New Conversation',
  'conversation.empty': 'No conversations',
  'conversation.messages': 'messages',

  // Floating AI Actions
  'aiAction.optimize': 'AI Optimize',
  'aiAction.layout': 'Auto Layout',
  'aiAction.beautify': 'Beautify',
  'aiAction.explain': 'Explain',
  'aiAction.generate': 'Generate Node',

  // Floating Toolbar
  'toolbar.select': 'Select',
  'toolbar.drag': 'Pan',
  'toolbar.text': 'Text',
  'toolbar.shape': 'Shape',
  'toolbar.arrow': 'Arrow',
  'toolbar.line': 'Line',
  'toolbar.image': 'Image',
  'toolbar.undo': 'Undo',
  'toolbar.redo': 'Redo',
  'toolbar.zoomIn': 'Zoom In',
  'toolbar.zoomOut': 'Zoom Out',

  // Error Boundary
  'error.title': 'Something Went Wrong',
  'error.description': 'The application encountered an error. Please refresh the page and try again.',
  'error.details': 'Error Details',
  'error.refresh': 'Refresh Page',

  // Image Upload
  'imageUpload.uploadText': 'Upload an image for recognition',
  'imageUpload.formats': 'Supports JPG, PNG, WebP, GIF, max 5MB',
  'imageUpload.processing': 'Processing...',
  'imageUpload.generating': 'Generating...',
  'imageUpload.selectImage': 'Select Image',
  'imageUpload.dropImage': 'Release to upload image',
  'imageUpload.preview': 'Preview',
  'imageUpload.deleteImage': 'Delete Image',
  'imageUpload.startGenerate': 'Start Generating',
  'imageUpload.recognizing': 'Recognizing...',

  // Diagram Canvas
  'canvas.unsupportedFormat': 'Unsupported format:',

  // Drawio Canvas
  'drawio.loadError': 'Unable to load diagram into Draw.io viewer',
  'drawio.renderError': 'Draw.io Render Error',

  // Mermaid Canvas
  'mermaid.renderFailed': 'Mermaid render failed',
  'mermaid.syntaxError': 'Mermaid Syntax Error',

  // Message Bubble
  'message.generatedCode': 'Generated Code',
  'message.characters': 'characters',

  // Scroll to top
  'scrollToTop': 'Back to Top',

  // Confirm dialog
  'confirm.title': 'Confirm Action',
  'confirm.confirm': 'Confirm',
  'confirm.cancel': 'Cancel',

  // Dropdown
  'dropdown.placeholder': 'Select...',
  'dropdown.selectChartType': 'Select chart type',

  // Language switcher
  'lang.label': 'Language',
  'lang.zh': '中文',
  'lang.en': 'English',

  // Time ago
  'time.justNow': 'just now',
  'time.minutesAgo': 'min ago',
  'time.hoursAgo': 'hr ago',
  'time.daysAgo': 'day ago',

  // Chart types
  'chart.auto': 'Auto',
  'chart.flowchart': 'Flowchart',
  'chart.mindmap': 'Mind Map',
  'chart.orgchart': 'Org Chart',
  'chart.sequence': 'Sequence',
  'chart.class': 'UML Class',
  'chart.er': 'ER Diagram',
  'chart.gantt': 'Gantt Chart',
  'chart.timeline': 'Timeline',
  'chart.tree': 'Tree',
  'chart.network': 'Network Topology',
  'chart.architecture': 'Architecture',
  'chart.dataflow': 'Data Flow',
  'chart.state': 'State Diagram',
  'chart.swimlane': 'Swimlane',
  'chart.concept': 'Concept Map',
  'chart.fishbone': 'Fishbone',
  'chart.swot': 'SWOT Analysis',
  'chart.pyramid': 'Pyramid',
  'chart.funnel': 'Funnel',
  'chart.venn': 'Venn Diagram',
  'chart.matrix': 'Matrix',
  'chart.infographic': 'Infographic',
};
