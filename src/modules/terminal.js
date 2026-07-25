// Terminal Module
// xterm.js UI in the renderer; the real shell (node-pty) lives in the main
// process and is reached over IPC, so the renderer stays sandboxed.

import { Terminal } from '../../node_modules/@xterm/xterm/lib/xterm.mjs';
import { FitAddon } from '../../node_modules/@xterm/addon-fit/lib/addon-fit.mjs';

// VS Code Dark Modern terminal palette
const DARK_THEME = {
    background: '#181818',
    foreground: '#CCCCCC',
    cursor: '#AEAFAD',
    selectionBackground: '#264F78',
    black: '#000000',
    red: '#CD3131',
    green: '#0DBC79',
    yellow: '#E5E510',
    blue: '#2472C8',
    magenta: '#BC3FBC',
    cyan: '#11A8CD',
    white: '#E5E5E5',
    brightBlack: '#666666',
    brightRed: '#F14C4C',
    brightGreen: '#23D18B',
    brightYellow: '#F5F543',
    brightBlue: '#3B8EEA',
    brightMagenta: '#D670D6',
    brightCyan: '#29B8DB',
    brightWhite: '#E5E5E5'
};

const LIGHT_THEME = {
    background: '#F3F3F3',
    foreground: '#3B3B3B',
    cursor: '#005FB8',
    selectionBackground: '#ADD6FF',
    black: '#000000',
    red: '#CD3131',
    green: '#107C10',
    yellow: '#949800',
    blue: '#0451A5',
    magenta: '#BC05BC',
    cyan: '#0598BC',
    white: '#555555',
    brightBlack: '#666666',
    brightRed: '#CD3131',
    brightGreen: '#14CE14',
    brightYellow: '#B5BA00',
    brightBlue: '#0451A5',
    brightMagenta: '#BC05BC',
    brightCyan: '#0598BC',
    brightWhite: '#A5A5A5'
};

export class TerminalManager {
    constructor(app) {
        this.app = app;
        this.term = null;
        this.fitAddon = null;
        this.shellAlive = false;
        this.panel = document.getElementById('terminal-panel');
        this.container = document.getElementById('terminal-container');
        this.resizeHandle = document.getElementById('terminal-resize-handle');
        this.panelHeight = 240;

        window.electronAPI.onToggleTerminal(() => this.toggle());
        window.electronAPI.onTerminalData((data) => this.term?.write(data));
        window.electronAPI.onTerminalExit(() => this.handleShellExit());

        document.getElementById('terminal-close').addEventListener('click', () => this.hide());
        document.getElementById('terminal-kill').addEventListener('click', () => this.kill());
        document.getElementById('terminal-maximize').addEventListener('click', () => this.toggleMaximize());
        this.setupResizeHandle();

        // Refit whenever the panel changes size (window resize, panel drag)
        this.resizeObserver = new ResizeObserver(() => {
            if (this.isVisible() && this.term) {
                this.fit();
            }
        });
        this.resizeObserver.observe(this.container);
    }

    isVisible() {
        return !this.panel.classList.contains('hidden');
    }

    toggle() {
        if (this.isVisible()) {
            this.hide();
        } else {
            this.show();
        }
    }

    async show() {
        this.panel.classList.remove('hidden');
        this.resizeHandle.classList.remove('hidden');
        this.panel.style.height = `${this.panelHeight}px`;

        if (!this.term) {
            this.term = new Terminal({
                fontFamily: 'Monaco, Menlo, monospace',
                fontSize: 12,
                cursorBlink: true,
                theme: this.currentTheme(),
                scrollback: 5000
            });
            this.fitAddon = new FitAddon();
            this.term.loadAddon(this.fitAddon);
            this.term.open(this.container);
            this.term.onData((data) => window.electronAPI.terminalInput(data));
        }

        this.fit();

        if (!this.shellAlive) {
            const result = await window.electronAPI.terminalCreate({
                cols: this.term.cols,
                rows: this.term.rows
            });
            if (result.success) {
                this.shellAlive = true;
                document.getElementById('terminal-shell-label').textContent = result.shellName || '';
            } else {
                this.term.writeln(`Failed to start shell: ${result.error}`);
                return;
            }
        }

        this.term.focus();
    }

    hide() {
        this.panel.classList.add('hidden');
        this.resizeHandle.classList.add('hidden');
        this.app.editor?.focus();
        this.app.editor?.layout();
    }

    async kill() {
        await window.electronAPI.terminalKill();
        // terminal-exit won't fire for a pty we killed ourselves on all
        // platforms, so tear down directly
        this.handleShellExit();
    }

    toggleMaximize() {
        const btn = document.getElementById('terminal-maximize');
        if (btn.classList.contains('maximized')) {
            btn.classList.remove('maximized');
            btn.title = 'Maximize panel size';
            this.panelHeight = this.restoreHeight || 240;
        } else {
            btn.classList.add('maximized');
            btn.title = 'Restore panel size';
            this.restoreHeight = this.panelHeight;
            this.panelHeight = Math.floor(window.innerHeight * 0.7);
        }
        this.panel.style.height = `${this.panelHeight}px`;
        this.fit();
    }

    handleShellExit() {
        // Shell ended (e.g. user typed `exit`): drop the session so the next
        // toggle starts fresh
        this.shellAlive = false;
        if (this.term) {
            this.term.dispose();
            this.term = null;
            this.fitAddon = null;
        }
        this.hide();
    }

    fit() {
        if (!this.fitAddon || !this.term) return;
        try {
            this.fitAddon.fit();
            if (this.shellAlive) {
                window.electronAPI.terminalResize(this.term.cols, this.term.rows);
            }
        } catch (err) {
            // Container not laid out yet; next observer tick will retry
        }
    }

    currentTheme() {
        return this.app.theme.getTheme() === 'light' ? LIGHT_THEME : DARK_THEME;
    }

    // Called by ThemeManager when the app theme flips
    applyTheme() {
        if (this.term) {
            this.term.options.theme = this.currentTheme();
        }
    }

    setupResizeHandle() {
        let dragging = false;

        this.resizeHandle.addEventListener('mousedown', (e) => {
            dragging = true;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const statusBarHeight = document.getElementById('status-bar').offsetHeight;
            const newHeight = window.innerHeight - e.clientY - statusBarHeight;
            this.panelHeight = Math.min(Math.max(newHeight, 100), window.innerHeight * 0.7);
            this.panel.style.height = `${this.panelHeight}px`;
        });

        document.addEventListener('mouseup', () => {
            if (dragging) {
                dragging = false;
                this.fit();
            }
        });
    }
}
