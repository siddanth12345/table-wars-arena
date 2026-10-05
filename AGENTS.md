<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Online play lives in `src/game/net.ts` over realtime broadcast/presence channels: each browser simulates its own player and streams its pose; the room host decides map pick, colours, rounds and scores. No database rows are used for rooms, so codes vanish when the host leaves.
- Accounts use username-derived sign-in emails (auto-confirm on); profile rows store settings/training so they follow the player.
