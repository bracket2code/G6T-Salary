const GROUPS_PARENT_ID = "e4c53b9c-fdaa-467a-a876-bbc96b9d3cfc";

const parseFirstString = (...values: Array<unknown>): string | undefined => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    } else if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    } else if (value && typeof value === "object") {
      const candidate = value as Record<string, unknown>;
      const nested = parseFirstString(
        candidate.id,
        candidate.parameterId,
        candidate.parameter_id,
        candidate.guid,
        candidate.value,
        candidate.key,
        candidate.code
      );
      if (nested) {
        return nested;
      }
    }
  }
  return undefined;
};

const parseParentIds = (item: Record<string, unknown>): string[] => {
  const sources: Array<unknown> = [
    item.subcategoryId,
    item.subCategoryId,
    item.subcategory,
    item.subCategory,
    item.subcategory_id,
    item.subCategory_id,
    item.parentId,
    item.parent,
    item.parent_id,
    item.parentParameterId,
    item.parentParameter,
    item.parentParameter_id,
    item.groupId,
    item.group_id,
    item.groupIds,
    item.groups,
    item.parents,
  ];

  const ids = new Set<string>();

  for (const source of sources) {
    if (Array.isArray(source)) {
      source.forEach((entry) => {
        const extracted = parseFirstString(entry);
        if (extracted) {
          ids.add(extracted);
        }
      });
    } else if (source && typeof source === "object") {
      const extracted = parseFirstString(source);
      if (extracted) {
        ids.add(extracted);
      }
    } else {
      const extracted = parseFirstString(source);
      if (extracted) {
        ids.add(extracted);
      }
    }
  }

  return Array.from(ids);
};

const toNumberOrUndefined = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const parsed = Number(trimmed);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const parseApiListPayload = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === "object") {
    const container = payload as Record<string, unknown>;
    const candidateKeys = ["data", "items", "results", "value", "list"];
    for (const key of candidateKeys) {
      const maybeArray = container[key];
      if (Array.isArray(maybeArray)) {
        return maybeArray;
      }
    }
  }
  return [];
};

export interface WorkerGroupApiResult {
  groups: Array<{
    id: string;
    label: string;
    description?: string;
  }>;
  membersByGroup: Record<string, string[]>;
  groupsByWorker: Record<string, string[]>;
}

export const createGroupId = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "sin-categoria";

export const fetchWorkerGroupsData = async (
  apiUrl: string,
  token: string,
  options: { preloadedWorkers?: unknown[] } = {}
): Promise<WorkerGroupApiResult> => {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const groupsResponse = await fetch(
    `${apiUrl}/Parameter/List?Parent=${GROUPS_PARENT_ID}&Types=0`,
    {
      method: "GET",
      headers,
    }
  );

  let groupItems: unknown[] = [];

  if (groupsResponse.ok) {
    try {
      const groupsBody = await groupsResponse.json();
      groupItems = parseApiListPayload(groupsBody);
    } catch (error) {
      if (groupsResponse.status !== 204 && groupsResponse.status !== 205) {
        console.error("No se pudieron parsear los grupos", error);
      }
      groupItems = [];
    }
  } else if (groupsResponse.status === 204 || groupsResponse.status === 404) {
    groupItems = [];
  } else {
    throw new Error(
      `Error al obtener grupos: ${groupsResponse.status} - ${groupsResponse.statusText}`
    );
  }

  let workerItems: unknown[] = [];

  if (options.preloadedWorkers && Array.isArray(options.preloadedWorkers)) {
    workerItems = options.preloadedWorkers;
  } else {
    const workerGroupsResponse = await fetch(
      `${apiUrl}/Parameter/List?Types[0]=4&Types[1]=5`,
      {
        method: "GET",
        headers,
      }
    );

    if (!workerGroupsResponse.ok) {
      throw new Error(
        `Error al obtener trabajadores para grupos: ${workerGroupsResponse.status} - ${workerGroupsResponse.statusText}`
      );
    }

    try {
      const workersBody = await workerGroupsResponse.json();
      workerItems = parseApiListPayload(workersBody);
    } catch (error) {
      if (
        workerGroupsResponse.status !== 204 &&
        workerGroupsResponse.status !== 205
      ) {
        console.error(
          "No se pudieron parsear los trabajadores para grupos",
          error
        );
      }
      workerItems = [];
    }
  }

  const groups: WorkerGroupApiResult["groups"] = [];
  const membersByGroup: Record<string, string[]> = {};
  const groupsByWorker: Record<string, string[]> = {};

  const asRecord = (value: unknown): Record<string, unknown> | null => {
    if (value && typeof value === "object") {
      return value as Record<string, unknown>;
    }
    return null;
  };

  groupItems.forEach((rawItem) => {
    const item = asRecord(rawItem);
    if (!item) {
      return;
    }

    const itemType = toNumberOrUndefined(item.type ?? item.parameterType);
    if (itemType !== 0) {
      return;
    }

    const id = parseFirstString(item.id, item.parameterId, item.guid);
    const label =
      parseFirstString(
        item.name,
        item.label,
        item.description,
        item.value
      ) ?? "Grupo sin nombre";

    if (!id) {
      return;
    }

    const description = parseFirstString(
      item.description,
      item.detail,
      item.notes
    );

    groups.push({ id, label, description: description ?? undefined });
    membersByGroup[id] = [];
  });

  workerItems.forEach((rawItem) => {
    const item = asRecord(rawItem);
    if (!item) {
      return;
    }

    const itemType = toNumberOrUndefined(item.type ?? item.parameterType);
    if (itemType !== 4 && itemType !== 5) {
      return;
    }

    const workerId = parseFirstString(
      item.id,
      item.parameterId,
      item.workerId,
      item.workerRelation,
      item.workerParameterId
    );

    if (!workerId) {
      return;
    }

    const parentIds = parseParentIds(item);

    if (!parentIds.length) {
      groupsByWorker[workerId] = [];
      return;
    }

    groupsByWorker[workerId] = parentIds;

    parentIds.forEach((parentId) => {
      if (!membersByGroup[parentId]) {
        membersByGroup[parentId] = [];
      }
      membersByGroup[parentId].push(workerId);
    });
  });

  return {
    groups,
    membersByGroup,
    groupsByWorker,
  };
};
