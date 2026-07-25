// Search Module
// Project-wide text search (Cmd+Shift+F). The file walk and matching run in
// the main process; this module owns the sidebar SEARCH view and results UI.

export class SearchManager {
    constructor(app) {
        this.app = app;
        this.caseSensitive = false;
        this.searchTimer = null;
        this.lastQuery = '';

        this.input = document.getElementById('search-input');
        this.summary = document.getElementById('search-summary');
        this.resultsEl = document.getElementById('search-results');
        this.caseToggle = document.getElementById('search-case-toggle');

        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchView(tab.dataset.view));
        });

        this.caseToggle.addEventListener('click', () => {
            this.caseSensitive = !this.caseSensitive;
            this.caseToggle.classList.toggle('active', this.caseSensitive);
            this.runSearch();
        });

        this.input.addEventListener('input', () => {
            clearTimeout(this.searchTimer);
            this.searchTimer = setTimeout(() => this.runSearch(), 300);
        });

        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(this.searchTimer);
                this.runSearch();
            }
        });

        window.electronAPI.onFindInFiles(() => this.openSearch());
    }

    switchView(view) {
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.view === view);
        });
        document.getElementById('file-tree').classList.toggle('hidden', view !== 'explorer');
        document.getElementById('search-view').classList.toggle('hidden', view !== 'search');
    }

    openSearch() {
        // Make sure the sidebar is visible, then show the search view
        const sidebar = document.getElementById('sidebar');
        if (sidebar.classList.contains('hidden')) {
            this.app.toggleSidebar();
        }
        this.switchView('search');
        this.input.focus();
        this.input.select();
    }

    async runSearch() {
        const query = this.input.value;
        this.lastQuery = query;

        if (query.length < 2) {
            this.summary.textContent = '';
            this.resultsEl.replaceChildren();
            return;
        }

        if (!this.app.openFolder) {
            this.summary.textContent = 'Open a folder to search';
            this.resultsEl.replaceChildren();
            return;
        }

        const result = await window.electronAPI.searchInFolder(query, {
            caseSensitive: this.caseSensitive
        });

        // A newer keystroke superseded this search while it ran
        if (this.lastQuery !== query) return;

        if (!result.success) {
            this.summary.textContent = result.error;
            this.resultsEl.replaceChildren();
            return;
        }

        this.render(result);
    }

    render({ results, filesSearched, truncated }) {
        const byFile = new Map();
        for (const match of results) {
            if (!byFile.has(match.relPath)) byFile.set(match.relPath, []);
            byFile.get(match.relPath).push(match);
        }

        this.summary.textContent = results.length === 0
            ? `No results in ${filesSearched} files`
            : `${results.length}${truncated ? '+' : ''} results in ${byFile.size} files`;

        const frag = document.createDocumentFragment();
        for (const [relPath, matches] of byFile) {
            const header = document.createElement('div');
            header.className = 'search-file-header';
            header.textContent = relPath;
            const count = document.createElement('span');
            count.className = 'search-file-count';
            count.textContent = String(matches.length);
            header.appendChild(count);
            frag.appendChild(header);

            for (const match of matches) {
                frag.appendChild(this.renderMatch(match));
            }
        }
        this.resultsEl.replaceChildren(frag);
    }

    renderMatch(match) {
        const row = document.createElement('div');
        row.className = 'search-match';
        row.title = `${match.relPath}:${match.line}`;

        // Trim long lines around the match so the highlight stays visible
        const text = match.text;
        const start = match.col - 1;
        let from = 0;
        if (start > 40) {
            from = start - 30;
        }
        if (from > 0) row.appendChild(document.createTextNode('…'));
        row.appendChild(document.createTextNode(text.slice(from, start)));

        const highlight = document.createElement('span');
        highlight.className = 'match-highlight';
        highlight.textContent = text.slice(start, start + match.matchLength);
        row.appendChild(highlight);

        row.appendChild(document.createTextNode(text.slice(start + match.matchLength)));

        row.addEventListener('click', () => this.jumpTo(match));
        return row;
    }

    async jumpTo(match) {
        await this.app.openFile(match.file);
        // Let the tab activation swap the editor model in before positioning
        requestAnimationFrame(() => {
            const editor = this.app.editor;
            if (!editor) return;
            editor.revealLineInCenter(match.line);
            editor.setSelection({
                startLineNumber: match.line,
                startColumn: match.col,
                endLineNumber: match.line,
                endColumn: match.col + match.matchLength
            });
            editor.focus();
        });
    }
}
