<script lang="ts">
  import {
    parsePotluckAnswer,
    standings,
    unclaimedIdeas,
    type PotluckAnswer,
    type PotluckView,
  } from '$lib/potluck';

  let {
    questionId,
    label,
    description = null,
    required = false,
    view,
    value = '',
    ownAnswer = null,
    offeredOverride = null,
    onchange,
  }: {
    questionId: string;
    label: string;
    description?: string | null;
    required?: boolean;
    view: PotluckView;
    value?: string;
    ownAnswer?: PotluckAnswer | null;
    offeredOverride?: string[] | null;
    onchange: (raw: string) => void;
  } = $props();

  const initial = parsePotluckAnswer(value);
  let category = $state(initial?.category ?? '');
  let dish = $state(initial?.dish ?? '');

  const counts = $derived.by(() => {
    if (!ownAnswer) return view.counts;
    const c = { ...view.counts };
    c[ownAnswer.category] = Math.max(0, (c[ownAnswer.category] ?? 1) - 1);
    return c;
  });

  const ranked = $derived(
    standings(view.config, counts).map((s) => ({
      ...s,
      offered:
        s.category.id === ownAnswer?.category ||
        (offeredOverride ? offeredOverride.includes(s.category.id) : s.reason !== 'closed'),
    })),
  );
  const open = $derived(ranked.filter((s) => s.offered));
  const closed = $derived(ranked.filter((s) => !s.offered));

  const takenByCategory = $derived(
    Object.fromEntries(
      view.config.categories.map((c) => [
        c.id,
        view.taken.filter((t) => t.category === c.id).map((t) => t.dish),
      ]),
    ),
  );

  $effect(() => {
    if (category && !open.some((s) => s.category.id === category)) category = '';
  });

  const raw = $derived(category && dish.trim() ? JSON.stringify({ category, dish: dish.trim() }) : '');
  $effect(() => onchange(raw));

  let dishInput: HTMLInputElement | undefined = $state();

  function choose(id: string, idea?: string) {
    category = id;
    if (idea) dish = idea;
    queueMicrotask(() => dishInput?.focus());
  }
</script>

<fieldset class="potluck">
  <legend>{label}{required ? ' *' : ''}</legend>
  {#if description}
    <small class="potluck-muted">{description}</small>
  {/if}
  {#if view.config.providing}
    <p class="potluck-providing"><strong>Hosts are providing:</strong> {view.config.providing}</p>
  {/if}

  <input type="hidden" name="response_{questionId}" value={raw} />

  <p class="potluck-muted">Pick what's needed most. Categories fill to keep the spread balanced.</p>

  <div class="potluck-options" role="radiogroup" aria-label="Dish category">
    {#each open as s, i (s.category.id)}
      {@const ideas = unclaimedIdeas(s.category, takenByCategory[s.category.id] ?? [])}
      {@const claimed = s.category.ideas.filter((idea) => !ideas.includes(idea))}
      <div class="potluck-option" class:selected={category === s.category.id}>
        <label class="potluck-option-head">
          <input
            type="radio"
            name="potluck_category_{questionId}"
            value={s.category.id}
            checked={category === s.category.id}
            onchange={() => choose(s.category.id)}
          />
          <span class="potluck-option-label">{s.category.label}</span>
          {#if i === 0 && s.deficit >= 1}
            <span class="potluck-tag">Needed most</span>
          {/if}
          <span class="potluck-count">{s.count} so far</span>
        </label>
        {#if s.category.ideas.length > 0}
          <div class="potluck-ideas">
            <span class="potluck-ideas-label">Need ideas? (examples, bring anything that fits)</span>
            <div class="potluck-chips">
              {#each ideas as idea}
                <button type="button" class="potluck-chip" onclick={() => choose(s.category.id, idea)}>{idea}</button>
              {/each}
              {#each claimed as idea}
                <span class="potluck-chip claimed" title="Someone is already bringing this">{idea}</span>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  {#if closed.length > 0}
    <p class="potluck-muted">
      Has enough for now: {closed.map((s) => s.category.label).join(', ')}
    </p>
  {/if}

  <label class="potluck-dish">
    <span>What are you bringing?{required || category ? ' *' : ''}</span>
    <input
      class="input-field"
      type="text"
      maxlength="80"
      bind:this={dishInput}
      bind:value={dish}
      required={required || !!category}
      placeholder={category ? 'Type your dish' : 'Pick a category first'}
    />
  </label>
</fieldset>

<style>
  .potluck {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    border: 0;
    padding: 0;
    margin: 0;
    min-width: 0;
  }
  legend {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }
  .potluck-muted {
    font-size: 0.85rem;
    color: var(--event-text-muted, #5f5177);
    margin: 0;
  }
  .potluck-providing {
    margin: 0;
    padding: 0.6rem 0.8rem;
    border-radius: 0.75rem;
    font-size: 0.9rem;
    background: var(--event-primary-50, #faf5ff);
    color: var(--event-text-secondary, #362a54);
  }
  .potluck-options {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .potluck-option {
    border: 1.5px solid var(--event-surface-border, rgba(124, 93, 250, 0.15));
    border-radius: 0.9rem;
    padding: 0.7rem 0.8rem;
    background: var(--event-card-surface, #fff);
  }
  .potluck-option.selected {
    border-color: var(--event-primary-600, #7c5dfa);
    box-shadow: 0 0 0 3px var(--event-primary-100, #f3e8ff);
  }
  .potluck-option-head {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    cursor: pointer;
    min-height: 2rem;
  }
  .potluck-option-head input {
    width: 1.1rem;
    height: 1.1rem;
    accent-color: var(--event-primary-600, #7c5dfa);
  }
  .potluck-option-label {
    font-weight: 600;
    color: var(--event-text-primary, #1b1430);
  }
  .potluck-tag {
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    background: var(--event-primary-100, #f3e8ff);
    color: var(--event-primary-800, #6b21a8);
  }
  .potluck-count {
    margin-left: auto;
    font-size: 0.8rem;
    color: var(--event-text-muted, #5f5177);
    white-space: nowrap;
  }
  .potluck-ideas {
    margin-top: 0.5rem;
  }
  .potluck-ideas-label {
    display: block;
    font-size: 0.78rem;
    color: var(--event-text-muted, #5f5177);
    margin-bottom: 0.35rem;
  }
  .potluck-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .potluck-chip {
    font-size: 0.8rem;
    line-height: 1.2;
    padding: 0.35rem 0.65rem;
    border-radius: 999px;
    border: 1px solid var(--event-surface-border, rgba(124, 93, 250, 0.2));
    background: var(--event-primary-50, #faf5ff);
    color: var(--event-text-secondary, #362a54);
    cursor: pointer;
  }
  .potluck-chip:hover {
    border-color: var(--event-primary-600, #7c5dfa);
  }
  .potluck-chip.claimed {
    cursor: default;
    text-decoration: line-through;
    opacity: 0.5;
    background: transparent;
  }
  .potluck-dish {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-weight: 600;
  }
</style>
