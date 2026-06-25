/**
 * 与 Obsidian UI 相关的工具函数（依赖 Notice），单独文件以便纯 utils 可被单元测试覆盖。
 */
import { Notice } from "obsidian";
import { GinkgoApiError } from "./types";

export function handleError(err: unknown, prefix: string): void {
	if (err instanceof GinkgoApiError) {
		new Notice(`Ginkgo: ${prefix} — ${err.userMessage}`, 8000);
	} else {
		const msg = err instanceof Error ? err.message : String(err);
		new Notice(`Ginkgo: ${prefix} — ${msg}`, 8000);
	}
}
