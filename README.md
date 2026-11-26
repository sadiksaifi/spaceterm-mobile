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

SpaceTerm runs on arm64 only, so use an Apple silicon Mac and an arm64 Android emulator or phone.

`pnpm ios` and `pnpm android` generate the `ios/` and `android/` projects only when they are missing. After `app.config.ts` changes, including when you switch branches, regenerate them with `pnpm expo prebuild --clean`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

SpaceTerm Mobile is open source under the [GNU GPL v3](LICENSE).
