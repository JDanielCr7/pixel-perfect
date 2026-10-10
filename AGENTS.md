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

## Architecture rules
- Simulator math lives in `src/lib/simulation/` as pure functions with no React imports — so it can be unit-tested and later swapped for a Python API with the same signature.
- Saved simulations persist in localStorage under their own key, separate from the main app DB — so the simulator never corrupts booking data.
