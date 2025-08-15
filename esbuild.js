const esbuild = require("esbuild")
const fs = require("fs")
const path = require("path")

const production = process.argv.includes("--production")
const watch = process.argv.includes("--watch")


/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: "esbuild-problem-matcher",

	setup(build) {
		build.onStart(() => {
			console.log("[watch] build started")
		})
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`)
				console.error(`    ${location.file}:${location.line}:${location.column}:`)
			})
			console.log("[watch] build finished")
		})
	},
}


// 复制React WebView资源到Web目录
const webviewDistDir = path.join(__dirname, 'webview-ui', 'build');
const webviewWebTargetDir = path.join(__dirname, 'dist', 'web', 'webview-ui');

if (!fs.existsSync(webviewWebTargetDir)) {
	fs.mkdirSync(webviewWebTargetDir, { recursive: true });
}

if (fs.existsSync(webviewDistDir)) {
	fs.cpSync(webviewDistDir, webviewWebTargetDir, { recursive: true });
	console.log('webview-ui页面资源已复制到web/dist目录');
}

const extensionConfig = {
	bundle: true,
	minify: production,
	sourcemap: !production,
	logLevel: "silent",
	plugins: [
		/* add to the end of plugins array */
		esbuildProblemMatcherPlugin,
	],
	entryPoints: ["src/extension.ts"],
	format: "cjs",
	sourcesContent: false,
	platform: "node",
	outfile: "dist/extension.js",
	external: ["vscode"],
}

async function main() {
	const extensionCtx = await esbuild.context(extensionConfig)
	if (watch) {
		await extensionCtx.watch()
	} else {
		await extensionCtx.rebuild()
		await extensionCtx.dispose()
	}
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
