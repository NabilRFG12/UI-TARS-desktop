/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Sparkles, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import type { OpenRouterModel } from '@main/ipcRoutes/setting';
import { api } from '@/renderer/src/api';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Badge } from '@renderer/components/ui/badge';
import { ScrollArea } from '@renderer/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog';
import { cn } from '@renderer/utils';

interface OpenRouterModelPickerProps {
  /** Currently selected model id, used to highlight the active row. */
  value?: string;
  /** Called with the chosen model id. */
  onSelect: (modelId: string) => void;
  disabled?: boolean;
}

/**
 * A searchable browser for OpenRouter's multimodal (image-input) models.
 *
 * The full GUI agent only grounds correctly with UI-TARS-family models, so
 * those are surfaced first and tagged. Other multimodal models can be selected
 * for experimentation but may not produce valid click/type actions.
 */
export function OpenRouterModelPicker({
  value,
  onSelect,
  disabled,
}: OpenRouterModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [query, setQuery] = useState('');

  const loadModels = async () => {
    setLoading(true);
    try {
      const list = await api.listOpenRouterModels();
      setModels(list);
    } catch (e) {
      toast.error('Failed to load OpenRouter models', {
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch once, the first time the dialog is opened.
  useEffect(() => {
    if (open && models.length === 0 && !loading) {
      loadModels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter(
      (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
    );
  }, [models, query]);

  const handlePick = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        Browse OpenRouter Models
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>OpenRouter multimodal models</DialogTitle>
            <DialogDescription>
              Models that accept image input. Tagged{' '}
              <span className="font-medium">UI-TARS</span> models are built for
              GUI control and work best with the agent — other models may not
              produce valid actions.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search models (e.g. ui-tars, qwen, gemini)..."
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading models…
            </div>
          ) : (
            <ScrollArea className="h-80 pr-3">
              <div className="space-y-1">
                {filtered.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No models match “{query}”.
                  </p>
                )}
                {filtered.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handlePick(m.id)}
                    className={cn(
                      'flex w-full flex-col items-start gap-0.5 rounded-md border border-transparent px-3 py-2 text-left transition-colors hover:bg-accent',
                      value === m.id && 'border-border bg-accent',
                    )}
                  >
                    <div className="flex w-full items-center gap-2">
                      <span className="truncate font-mono text-sm">{m.id}</span>
                      {m.isGuiGrounding ? (
                        <Badge className="shrink-0 gap-1">
                          <Sparkles className="h-3 w-3" />
                          UI-TARS
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0">
                          multimodal
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {m.contextLength != null && (
                        <span>{m.contextLength.toLocaleString()} ctx</span>
                      )}
                      {m.promptPricePerM != null && (
                        <span>${m.promptPricePerM.toFixed(2)}/M in</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}

          <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              For the agent to actually click and type, pick a{' '}
              <span className="font-medium">UI-TARS</span> model and set VLM
              Provider to “Hugging Face for UI-TARS-1.5”. Non-UI-TARS models
              connect for testing but generally won’t ground GUI actions.
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
