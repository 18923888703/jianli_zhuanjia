"use client";

import { useEffect, useState } from "react";
import { FileText, HardDrive, KeyRound, Eye, EyeOff, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { fetchAIStatus } from "@/services/ai/resumeAgent";
import { clearLLMConfig, getSavedLLMConfig, normalizeLLMBaseUrl, saveLLMConfig } from "@/lib/ai/connection-config";
import type { LLMConnectionConfig, LLMProtocol } from "@/lib/ai/connection-config";
import { useResumeStore } from "@/store/resume-store";

const DEFAULTS: Record<LLMProtocol, { baseUrl: string; model: string }> = {
  "openai-compatible": { baseUrl: "https://api.deepseek.com", model: "deepseek-flash" },
  anthropic: { baseUrl: "https://api.deepseek.com/anthropic", model: "deepseek-flash" },
};

const initialConfig = (): LLMConnectionConfig =>
  getSavedLLMConfig() ?? { protocol: "openai-compatible", ...DEFAULTS["openai-compatible"], apiKey: "" };

export function TopNav() {
  const { aiMode, setAiMode } = useResumeStore();
  const [mockReason, setMockReason] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<LLMConnectionConfig>(initialConfig);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const refreshStatus = () => {
    fetchAIStatus()
      .then((status) => {
        setAiMode(status.mode);
        if (status.reason === "missing_api_key") setMockReason("未配置 API Key");
        else if (status.reason === "forced") setMockReason("已强制 Mock");
        else setMockReason(null);
      })
      .catch(() => setAiMode("mock"));
  };

  useEffect(() => {
    setForm(initialConfig());
    refreshStatus();
  }, [setAiMode]);

  const save = () => {
    setError(null);
    setSaved(false);
    const baseUrl = normalizeLLMBaseUrl(form.protocol, form.baseUrl);
    if (!baseUrl || !form.apiKey.trim() || !form.model.trim()) {
      setError("请填写 Base URL、API Key 和模型名称。");
      return;
    }
    try {
      const parsed = new URL(baseUrl);
      if (parsed.protocol !== "https:") throw new Error();
    } catch {
      setError("Base URL 必须是有效的 HTTPS 地址。");
      return;
    }
    const next = { ...form, baseUrl, apiKey: form.apiKey.trim(), model: form.model.trim() };
    try {
      saveLLMConfig(next);
      setForm(next);
      setSaved(true);
      setAiMode("llm");
      setMockReason(null);
    } catch {
      setError("浏览器无法保存配置，请检查当前浏览器的本地存储设置。");
    }
  };

  const clear = () => {
    clearLLMConfig();
    setForm({ protocol: "openai-compatible", ...DEFAULTS["openai-compatible"], apiKey: "" });
    setError(null);
    setSaved(false);
    refreshStatus();
  };

  const changeProtocol = (protocol: LLMProtocol) => {
    setForm((current) => {
      const oldDefault = DEFAULTS[current.protocol].baseUrl;
      const useNewDefault = !current.baseUrl.trim() || current.baseUrl === oldDefault;
      const modelWasDefault = !current.model.trim() || current.model === DEFAULTS[current.protocol].model;
      return {
        ...current,
        protocol,
        baseUrl: useNewDefault ? DEFAULTS[protocol].baseUrl : current.baseUrl,
        model: modelWasDefault ? DEFAULTS[protocol].model : current.model,
      };
    });
    setSaved(false);
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-white px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm shadow-blue-900/15">
          <FileText className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="shrink-0">
          <h1 className="text-sm font-semibold tracking-tight text-slate-900">简历专家</h1>
        </div>
        <span className="hidden rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 sm:inline-block">
          JD 定制简历优化 Agent
        </span>
        {aiMode && (
          <Badge variant={aiMode === "llm" ? "success" : "secondary"} className="hidden font-normal sm:inline-flex">
            {aiMode === "llm" ? "AI 模式" : mockReason ? `Mock · ${mockReason}` : "Mock 模式"}
          </Badge>
        )}
        <Badge variant="outline" className="hidden items-center gap-1.5 font-normal text-slate-600 lg:inline-flex">
          <HardDrive className="h-3 w-3 text-blue-600" />
          自动保存在此浏览器
        </Badge>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <p className="hidden text-xs text-slate-500 xl:block">
          基于目标岗位 JD · 诊断 · 匹配 · 优化 · 面试准备
        </p>
        <Dialog open={open} onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) {
            setForm(initialConfig());
            setError(null);
            setSaved(false);
          }
        }}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Settings2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">大模型接入</span>
              <span className="sm:hidden">接入</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>手动配置大模型</DialogTitle>
              <DialogDescription>
                配置保存在此浏览器；请求由本应用后端转发，API Key 不会写入简历或分析结果。
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label htmlFor="llm-protocol">API 协议</Label>
                <select
                  id="llm-protocol"
                  value={form.protocol}
                  onChange={(event) => changeProtocol(event.target.value as LLMProtocol)}
                  className="flex h-9 w-full rounded-md border border-input bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="openai-compatible">OpenAI 兼容格式</option>
                  <option value="anthropic">Anthropic Messages 格式</option>
                </select>
                <p className="text-xs leading-relaxed text-slate-500">
                  {form.protocol === "openai-compatible"
                    ? "自动调用 /chat/completions。DeepSeek Base URL：https://api.deepseek.com"
                    : "自动调用 /v1/messages 并使用 x-api-key。DeepSeek Base URL：https://api.deepseek.com/anthropic"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="llm-base-url">API Base URL</Label>
                <Input
                  id="llm-base-url"
                  value={form.baseUrl}
                  onChange={(event) => { setForm({ ...form, baseUrl: event.target.value }); setSaved(false); }}
                  placeholder={DEFAULTS[form.protocol].baseUrl}
                  autoComplete="url"
                />
                <p className="text-xs text-slate-500">填基础地址即可；系统会自动拼接对应协议的接口路径。</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="llm-api-key">API Key</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="llm-api-key"
                    type={showKey ? "text" : "password"}
                    value={form.apiKey}
                    onChange={(event) => { setForm({ ...form, apiKey: event.target.value }); setSaved(false); }}
                    placeholder="粘贴服务商提供的 API Key"
                    autoComplete="new-password"
                    className="pl-9 pr-10"
                  />
                  <button
                    type="button"
                    aria-label={showKey ? "隐藏 API Key" : "显示 API Key"}
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1.5 rounded p-1 text-slate-400 hover:text-slate-700"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500">Key 只保存在当前浏览器的本地存储中，并随请求发送到本应用后端。</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="llm-model">模型名称</Label>
                <Input
                  id="llm-model"
                  value={form.model}
                  onChange={(event) => { setForm({ ...form, model: event.target.value }); setSaved(false); }}
                  placeholder="deepseek-flash"
                  autoComplete="off"
                />
              </div>

              {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              {saved && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">配置已保存并启用。后续分析和追问将使用此设置。</p>}

              <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
                <Button type="button" variant="ghost" onClick={clear}>清除本机配置</Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>取消</Button>
                  <Button type="button" onClick={save}>保存并启用</Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}
