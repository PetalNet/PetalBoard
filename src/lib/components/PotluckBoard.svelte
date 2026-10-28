<script lang="ts">
  import type { PotluckView } from '$lib/potluck';

  let { label, view }: { label: string; view: PotluckView } = $props();

  const total = $derived(view.taken.length);
  const ratioSum = $derived(view.config.categories.reduce((sum, c) => sum + c.ratio, 0));
  const rows = $derived(
    view.config.categories.map((c) => {
      const dishes = view.taken.filter((t) => t.category === c.id);
      const target = c.ratio / ratioSum;
      return { category: c, dishes, target, actual: total ? dishes.length / total : 0 };
    }),
  );
</script>

<section class="card event-card mb-8 potluck-board">
  <div class="board-head">
    <h2>{label}</h2>
    <span class="board-total">{total} {total === 1 ? 'dish' : 'dishes'}</span>
  </div>
  {#if view.config.providing}
    <p class="board-providing"><strong>Hosts are providing:</strong> {view.config.providing}</p>
  {/if}
  <ul class="board-rows">
    {#each rows as row (row.category.id)}
      <li>
        <div class="board-row-head">
          <span class="board-cat">{row.category.label}</span>
          <span class="board-meta">{row.dishes.length} · aiming for {Math.round(row.target * 100)}%</span>
        </div>
        <div class="board-bar" aria-hidden="true">
          <span class="board-bar-fill" style="width: {Math.min(100, row.actual * 100)}%"></span>
          <span class="board-bar-target" style="left: {row.target * 100}%"></span>
        </div>
        {#if row.dishes.length > 0}
          <ul class="board-dishes">
            {#each row.dishes as d}
              <li>{d.dish}{#if d.name}<span class="board-who">{d.name}</span>{/if}</li>
            {/each}
          </ul>
        {:else}
          <p class="board-empty">Nothing yet</p>
        {/if}
      </li>
    {/each}
  </ul>
</section>

<style>
  .board-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    padding-bottom: 0.75rem;
    margin-bottom: 0.75rem;
    border-bottom: 1px solid var(--event-surface-border, rgba(124, 93, 250, 0.12));
  }
  h2 {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 700;
    color: var(--event-text-primary, #1b1430);
  }
  .board-total,
  .board-meta {
    font-size: 0.85rem;
    color: var(--event-text-muted, #5f5177);
    white-space: nowrap;
  }
  .board-providing {
    margin: 0 0 1rem;
    font-size: 0.9rem;
    color: var(--event-text-secondary, #362a54);
  }
  .board-rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 1.1rem;
  }
  .board-row-head {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .board-cat {
    font-weight: 600;
    color: var(--event-text-primary, #1b1430);
  }
  .board-bar {
    position: relative;
    height: 6px;
    margin: 0.4rem 0 0.5rem;
    border-radius: 999px;
    background: var(--event-primary-100, #f3e8ff);
  }
  .board-bar-fill {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: 999px;
    background: var(--event-primary-600, #7c5dfa);
  }
  .board-bar-target {
    position: absolute;
    top: -3px;
    width: 2px;
    height: 12px;
    background: var(--event-text-primary, #1b1430);
  }
  .board-dishes {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .board-dishes li {
    font-size: 0.85rem;
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    background: var(--event-primary-50, #faf5ff);
    color: var(--event-text-secondary, #362a54);
  }
  .board-who {
    color: var(--event-text-muted, #5f5177);
  }
  .board-who::before {
    content: '·';
    margin: 0 0.35em;
  }
  .board-empty {
    margin: 0;
    font-size: 0.85rem;
    color: var(--event-text-muted, #5f5177);
  }
</style>
