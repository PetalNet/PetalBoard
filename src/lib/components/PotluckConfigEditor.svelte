<script lang="ts">
  import { slugifyCategory, type PotluckConfig } from '$lib/potluck';

  let { initial, errors = [] }: { initial: PotluckConfig; errors?: string[] } = $props();

  type Row = { id: string | null; label: string; ratio: number; ideas: string; forceOpen: boolean };

  let providing = $state(initial.providing);
  let minOptions = $state(initial.minOptions);
  let rows = $state<Row[]>(
    initial.categories.map((c) => ({ ...c, ideas: c.ideas.join(', ') })),
  );

  const ratioTotal = $derived(rows.reduce((sum, r) => sum + (Number(r.ratio) || 0), 0));

  const serialized = $derived.by(() => {
    const used = new Set<string>();
    const categories = rows.map((r) => {
      let id = r.id ?? slugifyCategory(r.label);
      for (let n = 2; used.has(id); n++) id = `${slugifyCategory(r.label)}-${n}`;
      used.add(id);
      return {
        id,
        label: r.label,
        ratio: Number(r.ratio),
        ideas: r.ideas.split(',').map((s) => s.trim()).filter(Boolean),
        forceOpen: r.forceOpen,
      };
    });
    return JSON.stringify({ providing, minOptions: Number(minOptions), categories });
  });

  function addRow() {
    rows.push({ id: null, label: '', ratio: 10, ideas: '', forceOpen: false });
  }
</script>

<div class="space-y-4">
  <input type="hidden" name="potluckConfig" value={serialized} />

  <label class="form-label">
    <span>We're providing</span>
    <input class="input-field" maxlength="200" bind:value={providing} placeholder="Pulled chicken, pulled pork, and mac and cheese" />
    <small class="text-sm text-gray-600">Shown at the top so guests know what's covered</small>
  </label>

  <div class="space-y-3">
    <div class="flex items-baseline justify-between gap-3">
      <span class="font-semibold text-dark-900">Dish categories</span>
      <small class="text-sm {ratioTotal === 100 ? 'text-gray-600' : 'text-orange-700'}">Shares total {ratioTotal}%</small>
    </div>
    {#each rows as row, i}
      <div class="border border-primary-700/15 rounded-xl p-3 space-y-2">
        <div class="flex flex-wrap gap-2 items-end">
          <label class="form-label flex-1 min-w-[10rem]">
            <span class="text-sm">Category</span>
            <input class="input-field" required maxlength="40" bind:value={row.label} />
          </label>
          <label class="form-label w-24">
            <span class="text-sm">Share %</span>
            <input class="input-field" type="number" min="1" max="100" required bind:value={row.ratio} />
          </label>
          <button type="button" class="btn-secondary px-3" aria-label="Remove {row.label || 'category'}" onclick={() => rows.splice(i, 1)} disabled={rows.length <= 2}>✕</button>
        </div>
        <label class="form-label">
          <span class="text-sm">Ideas for guests (comma separated, optional)</span>
          <textarea class="input-field" rows="2" bind:value={row.ideas}></textarea>
        </label>
      </div>
    {/each}
    <button type="button" class="btn-secondary" onclick={addRow}>+ Add category</button>
  </div>

  <label class="form-label">
    <span>Always offer at least</span>
    <input class="input-field w-24" type="number" min="1" max={rows.length} bind:value={minOptions} />
    <small class="text-sm text-gray-600">Categories a guest can pick from, even when the mix is off target</small>
  </label>

  {#each errors as message}
    <small class="text-red-600 text-sm block">{message}</small>
  {/each}
</div>
