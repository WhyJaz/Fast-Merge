import { useCallback } from "react"
import { useEvent } from "react-use"
import { vscode } from "./utils/vscode"

const App = () => {

	// 监听来自扩展层的消息
	const handleMessage = useCallback((e: MessageEvent) => {
		console.log(e, "webview层收到消息")
	}, [])
	useEvent("message", handleMessage)

	return (
		<div>
			基础测试7
			<button
				onClick={() => {
					vscode.postMessage({ type: "notify", message: "向扩展层发送消息" })
				}}>
				测试消息7
			</button>
		</div>
	)
}

export default App
