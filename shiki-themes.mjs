// Code themes matched to the site palette: warm paper in light mode, warm
// charcoal in dark. Every token colour clears WCAG AA (4.5:1) on its background.

/** @param {string} name @param {'light'|'dark'} type @param {Record<string,string>} c */
function theme(name, type, c) {
  return {
    name,
    type,
    colors: { 'editor.background': c.bg, 'editor.foreground': c.fg },
    settings: [
      { settings: { background: c.bg, foreground: c.fg } },
      { scope: ['comment', 'punctuation.definition.comment', 'string.comment'], settings: { foreground: c.comment } },
      { scope: ['keyword', 'storage', 'storage.type', 'storage.modifier', 'keyword.operator.new', 'keyword.control'], settings: { foreground: c.keyword } },
      { scope: ['keyword.operator', 'punctuation', 'meta.brace', 'punctuation.separator', 'punctuation.terminator'], settings: { foreground: c.punct } },
      { scope: ['string', 'string.quoted', 'string.template', 'markup.inline.raw', 'punctuation.definition.string'], settings: { foreground: c.string } },
      { scope: ['constant.numeric', 'constant.language', 'constant.character', 'constant.other', 'support.constant'], settings: { foreground: c.number } },
      { scope: ['entity.name.function', 'support.function', 'meta.function-call', 'variable.function', 'entity.name.command'], settings: { foreground: c.func } },
      { scope: ['entity.name.type', 'entity.name.class', 'support.type', 'support.class', 'entity.other.inherited-class', 'storage.type.class'], settings: { foreground: c.type } },
      { scope: ['variable.other', 'variable.parameter', 'variable.language', 'variable.other.readwrite', 'punctuation.definition.variable'], settings: { foreground: c.variable } },
      { scope: ['entity.name.tag', 'support.type.property-name', 'meta.object-literal.key', 'entity.other.attribute-name'], settings: { foreground: c.func } },
      { scope: ['entity.name.section', 'markup.heading'], settings: { foreground: c.keyword, fontStyle: 'bold' } },
      { scope: ['markup.bold'], settings: { fontStyle: 'bold' } },
      { scope: ['markup.italic'], settings: { fontStyle: 'italic' } },
      { scope: ['markup.inserted'], settings: { foreground: c.string } },
      { scope: ['markup.deleted', 'invalid'], settings: { foreground: c.variable } },
    ],
  };
}

export const warmLight = theme('warm-light', 'light', {
  bg: '#fbfaf7',
  fg: '#2b2a26',
  comment: '#736e63',
  keyword: '#5b4a8a',
  punct: '#5e5a52',
  string: '#5f6b2e',
  number: '#8a5a14',
  func: '#1f4f6b',
  type: '#6b4a2a',
  variable: '#8c3b1f',
});

export const warmDark = theme('warm-dark', 'dark', {
  bg: '#211d18',
  fg: '#e4e0d8',
  comment: '#958f84',
  keyword: '#c4a6e0',
  punct: '#aaa497',
  string: '#b5c07a',
  number: '#e0b36a',
  func: '#8fc3d9',
  type: '#d9b48f',
  variable: '#e59a74',
});
