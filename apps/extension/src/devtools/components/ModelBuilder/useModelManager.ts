import { useCallback, useState } from 'react';
import type { TestModel, ElementBinding } from '@like-cake/mbt-catalog';
import { nanoid } from '../../utils/nanoid';

const STORAGE_KEY = 'like-cake-models';

interface StoredModelEntry {
  id: string;
  name: string;
  updatedAt: number;
}

interface UseModelManagerOptions {
  toTestModel: (meta: {
    id: string;
    name: string;
    description?: string;
    baseUrl: string;
    elementBindings: ElementBinding[];
  }) => TestModel;
  fromTestModel: (model: TestModel) => void;
  clearModel: () => void;
}

function readModels(): Record<string, TestModel> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeModels(models: Record<string, TestModel>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(models));
}

export function useModelManager(options: UseModelManagerOptions) {
  const { toTestModel, fromTestModel, clearModel } = options;

  const [modelId, setModelId] = useState<string | null>(null);
  const [modelName, setModelNameInternal] = useState('');
  const [modelDescription, setModelDescriptionInternal] = useState('');
  const [baseUrl, setBaseUrlInternal] = useState('');
  const [elementBindings, setElementBindings] = useState<ElementBinding[]>([]);
  const [isModified, setIsModified] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const setModelName = useCallback((name: string) => {
    setModelNameInternal(name);
    setIsModified(true);
  }, []);

  const setModelDescription = useCallback((desc: string) => {
    setModelDescriptionInternal(desc);
    setIsModified(true);
  }, []);

  const setBaseUrl = useCallback((url: string) => {
    setBaseUrlInternal(url);
    setIsModified(true);
  }, []);

  const markModified = useCallback(() => {
    setIsModified(true);
  }, []);

  const saveModel = useCallback((): string | null => {
    const trimmedName = modelName.trim();
    if (!trimmedName) return null;

    setIsSaving(true);
    try {
      const id = modelId || nanoid(12);
      const model = toTestModel({
        id,
        name: trimmedName,
        description: modelDescription || undefined,
        baseUrl,
        elementBindings,
      });

      // Preserve existing timestamps if updating
      const models = readModels();
      const existing = models[id];
      if (existing) {
        model.meta.createdAt = existing.meta.createdAt;
        model.meta.version = existing.meta.version + 1;
      }
      model.meta.updatedAt = Date.now();

      models[id] = model;
      writeModels(models);

      setModelId(id);
      setIsModified(false);
      return id;
    } finally {
      setIsSaving(false);
    }
  }, [modelId, modelName, modelDescription, baseUrl, elementBindings, toTestModel]);

  const loadModel = useCallback(
    (targetModelId: string): boolean => {
      const models = readModels();
      const model = models[targetModelId];
      if (!model) return false;

      fromTestModel(model);
      setModelId(model.id);
      setModelNameInternal(model.name);
      setModelDescriptionInternal(model.description || '');
      setBaseUrlInternal(model.baseUrl);
      setElementBindings(model.elementBindings);
      setIsModified(false);
      return true;
    },
    [fromTestModel]
  );

  const listModels = useCallback((): StoredModelEntry[] => {
    const models = readModels();
    return Object.values(models)
      .map((m) => ({ id: m.id, name: m.name, updatedAt: m.meta.updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, []);

  const deleteModel = useCallback(
    (targetModelId: string) => {
      const models = readModels();
      delete models[targetModelId];
      writeModels(models);

      if (targetModelId === modelId) {
        clearModel();
        setModelId(null);
        setModelNameInternal('');
        setModelDescriptionInternal('');
        setBaseUrlInternal('');
        setElementBindings([]);
        setIsModified(false);
      }
    },
    [modelId, clearModel]
  );

  const exportModel = useCallback((): TestModel | null => {
    const trimmedName = modelName.trim();
    if (!trimmedName) return null;

    return toTestModel({
      id: modelId || nanoid(12),
      name: trimmedName,
      description: modelDescription || undefined,
      baseUrl,
      elementBindings,
    });
  }, [modelId, modelName, modelDescription, baseUrl, elementBindings, toTestModel]);

  const createNewModel = useCallback((): { needsConfirmation: boolean } => {
    if (isModified) {
      return { needsConfirmation: true };
    }

    clearModel();
    setModelId(null);
    setModelNameInternal('');
    setModelDescriptionInternal('');
    setBaseUrlInternal('');
    setElementBindings([]);
    setIsModified(false);
    return { needsConfirmation: false };
  }, [isModified, clearModel]);

  const forceCreateNewModel = useCallback(() => {
    clearModel();
    setModelId(null);
    setModelNameInternal('');
    setModelDescriptionInternal('');
    setBaseUrlInternal('');
    setElementBindings([]);
    setIsModified(false);
  }, [clearModel]);

  const addElementBinding = useCallback((binding: ElementBinding) => {
    setElementBindings((prev) => [...prev, binding]);
    setIsModified(true);
  }, []);

  const updateElementBinding = useCallback((bindingId: string, updates: Partial<ElementBinding>) => {
    setElementBindings((prev) =>
      prev.map((b) => (b.id === bindingId ? { ...b, ...updates } : b))
    );
    setIsModified(true);
  }, []);

  const removeElementBinding = useCallback((bindingId: string) => {
    setElementBindings((prev) => prev.filter((b) => b.id !== bindingId));
    setIsModified(true);
  }, []);

  return {
    modelId,
    modelName,
    modelDescription,
    baseUrl,
    elementBindings,
    isModified,
    isSaving,

    setModelName,
    setModelDescription,
    setBaseUrl,
    markModified,

    saveModel,
    loadModel,
    listModels,
    deleteModel,
    exportModel,
    createNewModel,
    forceCreateNewModel,

    addElementBinding,
    updateElementBinding,
    removeElementBinding,
  };
}
