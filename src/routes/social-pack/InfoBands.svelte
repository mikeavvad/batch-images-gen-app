<script lang="ts">
  export let githubUrl = '';
</script>

<section class="info-band" aria-labelledby="built-title">
  <div>
    <p class="eyebrow">How It Was Built</p>
    <h2 id="built-title">Directed AI workflow with manual product judgment</h2>
  </div>

  <div class="build-story">
    <article>
      <h3>How it was built</h3>
      <p>
        I used AI throughout the project, but as a directed process rather than autonomous
        building. I gave the agent the assignment link and asked it to analyze requirements,
        propose an implementation plan, and flag unclear points. After adjusting and approving the
        plan, the implementation agent built the first version, which the auditor then reviewed
        without finding major issues.
      </p>
      <p>
        I then reviewed the code manually before running it. The file organization needed work -
        too much logic was grouped together, hurting readability - so I asked the agent to split it
        into separate files for types, utilities, API logic, and UI/layout. The result was much
        easier to follow.
      </p>
      <p>
        After that, I ran the app myself and tested image generation with a real API key. It worked,
        but took over three minutes per request, revealing that the synchronous upload-and-wait flow
        was a poor UX fit for such a slow operation. I overrode that approach and asked the AI to
        redesign it using a streaming-style solution with WebSockets or server-sent events. We
        planned and implemented the change, updated the tests, and I validated the new behavior
        manually.
      </p>
      <p>
        AI handled task breakdown, initial implementation, refactoring, and test updates. I handled
        product judgment, architecture review, manual QA, and UX decisions. The AI's main miss was
        assuming a synchronous request/response flow would suffice for image generation -
        functional, but wrong for the experience.
      </p>
    </article>

    <article>
      <h3>Toolset</h3>
      <p>I used Codex with a custom agent workflow:</p>
      <ul>
        <li>
          <strong>planning agent</strong> for reading the task, asking clarifying questions, and
          proposing the implementation plan
        </li>
        <li>
          <strong>implementation agent</strong> for writing the code after I approved the plan
        </li>
        <li>
          <strong>auditor agent</strong> for reviewing the implementation before I considered it
          complete
        </li>
        <li>
          <strong>advisor</strong> as a high-capability read-only model that any agent could call
          when it needed architectural guidance or a second opinion
        </li>
      </ul>
      <p>
        For models, I used stronger GPT-5.5 high-style reasoning for planning and review, and
        GPT-5.5 / GPT-5.4 medium-to-low settings for implementation and smaller fixes. I also used
        the <code>typescript-pro</code> tool/skill to reduce mistakes around TypeScript types and
        keep the code stricter.
      </p>
      <p>
        My general flow was: give the task, review and approve the planning agent's plan, let the
        implementation agent build it, then have the auditor review it and send it back for fixes if
        needed. I considered using Oh-my-codex, but decided this project was small enough that the
        custom Codex agent workflow was sufficient.
      </p>
    </article>

    <article>
      <h3>Time breakdown</h3>
      <p>
        Total time spent: about <strong>3.5 to 4 hours</strong>.
      </p>
      <p>
        My hands-on time: about <strong>2 hours</strong>, mostly spent thinking through the plan,
        reviewing the code, deciding on refactors, testing manually, and thinking through how to
        improve the slow image-generation flow.
      </p>
      <p>
        AI/LLM working time: roughly <strong>40 minutes</strong> for the main implementation, plus
        a few <strong>10-15 minute</strong> sessions for refactoring, and a couple of shorter
        <strong>5 minute</strong> sessions for fixes.
      </p>
    </article>

    <article>
      <h3>What could be improved</h3>
      <p>
        The biggest improvement would be to move the generation flow to a fully asynchronous
        pipeline. Instead of keeping the user inside a long request, the app could create a job,
        stream status updates over WebSocket or server-sent events, and show partial progress as
        each product is processed. That would make the UI feel more responsive, support retries per
        image, and allow the user to safely leave and return to an in-progress job.
      </p>
      <p>
        The grader could also be made stronger and more stable. A dedicated system prompt with a
        clear rubric, examples of strong and weak outputs, stricter scoring criteria, and explicit
        checks for brand fit, composition, text safety, and visual clarity would likely improve both
        quality and consistency. For even more reliability, the grader could return structured JSON
        with reasons, scores, and suggested prompt edits before the final image is selected.
      </p>
      <p>
        I would also revisit the UI itself. The current interface is functional, but I do not like
        it as much as I would want to: the layout, visual hierarchy, empty states, progress feedback,
        and final result presentation could all be improved to make the product feel more polished
        and easier to use.
      </p>
    </article>
  </div>
</section>

<section class="code-band" aria-labelledby="code-title">
  <div>
    <p class="eyebrow">The Code</p>
  </div>
  <a class="repo-link" target="_blank" href={githubUrl}>Open GitHub repo ({githubUrl})</a>
</section>
