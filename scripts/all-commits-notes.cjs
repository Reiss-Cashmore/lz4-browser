module.exports = {
  async generateNotes(pluginConfig, context) {
    const commits = context.commits || [];
    if (!commits.length) {
      return null;
    }

    const lines = commits.map((commit) => {
      const hash = commit.hash ? commit.hash.slice(0, 7) : '';
      const subject = commit.subject || commit.message.split('\n')[0] || '(no message)';
      return `- ${subject}${hash ? ` (${hash})` : ''}`;
    });

    return `### All Commits\n${lines.join('\n')}\n`;
  }
};
