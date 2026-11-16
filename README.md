> [!WARNING]
> SpaceTerm Mobile is in early development. There is nothing to install yet.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/logo/spaceterm-icon-dark.svg">
    <img src="assets/brand/logo/spaceterm-icon.svg" width="128" height="128" alt="">
  </picture>
</p>

<h1 align="center">SpaceTerm for iOS and Android</h1>

<p align="center">Your SpaceTerm terminals, in your pocket.</p>

## Develop

You need a Mac with Xcode for iOS, Android Studio for Android, and [mise](https://mise.jdx.dev).

```sh
git clone https://github.com/sadiksaifi/spaceterm-mobile
cd spaceterm-mobile
mise install   # toolchain pinned in .mise.toml
pnpm install   # dependencies and Git hooks
pnpm ios       # iPhone 18 Pro simulator
pnpm android   # running Android emulator
```

## License

SpaceTerm Mobile is open source under the [GNU GPL v3](LICENSE).
