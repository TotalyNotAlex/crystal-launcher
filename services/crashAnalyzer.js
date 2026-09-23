class CrashAnalyzer {
  analyze(content) {
    if (!content) return { title: 'Unknown error', summary: 'No crash details found.', hints: [] };
    const text = String(content);
    const hints = [];
    let title = 'Game crashed';
    let summary = 'Minecraft exited unexpectedly.';

    const patterns = [
      {
        test: /UnsupportedClassVersionError|has been compiled by a more recent version of the Java Runtime|class file has wrong version/i,
        title: 'Wrong Java version',
        summary: 'The game (or a mod) needs a different Java version than the one used to launch.',
        hints: ['Settings → Java Runtime: install Java 21+', 'Make sure the custom Java path points to a 64-bit JDK/JRE 21+'],
      },
      {
        test: /OutOfMemoryError|Java heap space|GC overhead limit exceeded/i,
        title: 'Out of memory',
        summary: 'Minecraft ran out of RAM.',
        hints: ['Settings → Memory: raise max RAM (6–8 GB is a good start)', 'Close other apps while playing', 'Remove memory-hungry mods or shaders'],
      },
      {
        test: /no lwjgl in java\.library\.path|Failed to load library|LWJGLException|no lwjgl/i,
        title: 'Graphics / LWJGL failure',
        summary: 'Native graphics libraries failed to load.',
        hints: ['Update your GPU drivers', 'Try running the launcher as administrator once', 'Reinstall the Minecraft version (delete the version folder and relaunch)'],
      },
      {
        test: /ModResolutionException|Mod resolution failed|depends on mod .* which is missing|requires .* which is not installed|Missing .* dependency/i,
        title: 'Missing mod dependency',
        summary: 'A mod requires another mod that is not installed (or is disabled).',
        hints: ['Mods → Installed: enable the missing dependency', 'Reinstall the mod so required deps install automatically', 'Check the crash log for the exact mod name'],
      },
      {
        test: /DuplicateModsError|Found duplicate mods|multiple mods of the same id|duplicate/i,
        title: 'Duplicate mods',
        summary: 'Two or more mods provide the same content ID.',
        hints: ['Mods → Installed: remove one of the duplicates', 'Common with accidentally installing both .jar and .disabled copies'],
      },
      {
        test: /MixinApplyError|Mixin apply failed|@Mixin target .* was not found|InvalidInjectionException/i,
        title: 'Mod incompatible with this version',
        summary: 'A mod tried to patch Minecraft but the target code was not found — usually a version mismatch.',
        hints: ['Update all mods to versions matching your Minecraft + loader', 'Remove recently added mods to find the culprit', 'Check Mods → Installed for "Check Updates"'],
      },
      {
        test: /NoSuchMethodError|NoSuchFieldError|AbstractMethodError/i,
        title: 'Mod/API version conflict',
        summary: 'A mod called an API that does not exist in this build — mixed versions or outdated library mod.',
        hints: ['Update Fabric API / Forge / NeoForge related mods', 'Update or remove the mod named in the stack trace'],
      },
      {
        test: /NoClassDefFoundError|ClassNotFoundException/i,
        title: 'Missing class',
        summary: 'A required class could not be found — incomplete install or missing library.',
        hints: ['Reinstall the Minecraft version', 'Re-enable disabled mods', 'Check that Fabric API / Architectury is installed if required'],
      },
      {
        test: /Could not reserve enough space|Unable to create new native thread/i,
        title: 'Not enough memory to start',
        summary: 'Windows could not allocate memory for the Java process.',
        hints: ['Lower max RAM slightly if other apps need memory', 'Close browsers and background apps', 'Make sure you are on 64-bit Windows with enough free RAM'],
      },
      {
        test: /Authentication servers are down|Invalid session|Failed to verify username|session\.minecraft\.net/i,
        title: 'Authentication problem',
        summary: 'Could not verify your account with Mojang/Microsoft.',
        hints: ['Accounts: remove and re-add your Microsoft account', 'Check your internet connection', 'Try again in a minute if Mojang services are down'],
      },
      {
        test: /GLFW error|OpenGL|Pixel format not accelerated/i,
        title: 'OpenGL / display driver problem',
        summary: 'Your GPU driver or OpenGL implementation failed.',
        hints: ['Update GPU drivers (NVIDIA/AMD/Intel)', 'Disable shaders if enabled', 'On laptops, force the dedicated GPU for Java'],
      },
      {
        test: /failed to download|Download failed|Could not download|IOException.*minecraft\.net|resources\.download\.minecraft\.net/i,
        title: 'Download failed',
        summary: 'Minecraft could not download game files.',
        hints: ['Check internet connection / VPN', 'Pause other downloads', 'Relaunch to retry the download'],
      },
      {
        test: /Main method not found|no suitable main|Could not find or load main class/i,
        title: 'Broken launch configuration',
        summary: 'The launcher could not find the game entry point — version files may be corrupt.',
        hints: ['Settings → Versions: open versions folder and delete this version', 'Play again to re-download', 'Try a fresh profile'],
      },
      {
        test: /Thread.*died|Fatal exception|A fatal error has been detected/i,
        title: 'Fatal JVM error',
        summary: 'The Java runtime crashed — often a native library or driver issue.',
        hints: ['Update GPU and audio drivers', 'Remove the most recently installed mods', 'Try a clean profile to see if it still crashes'],
      },
    ];

    for (const p of patterns) {
      if (p.test.test(text)) {
        title = p.title;
        summary = p.summary;
        hints.push(...p.hints);
        break;
      }
    }

    const modCrash = text.match(/(?:Caused by:.*?|failed to load|mod id\s*['"]?)([a-z0-9_.-]{3,40})/i);
    const fileMention = text.match(/([\w.-]+\.jar)/);
    const culprit = (modCrash && modCrash[1]) || (fileMention && fileMention[1]) || null;
    if (culprit && !hints.some((h) => h.toLowerCase().includes(String(culprit).toLowerCase()))) {
      hints.push(`Suspect involved: ${culprit}`);
    }

    if (title === 'Game crashed' && /Mixin|mod/i.test(text)) {
      summary = 'Likely caused by a mod. Check the details below.';
      hints.push('Remove recently added mods one by one to isolate the issue');
      hints.push('Mods → Installed: run Check Updates');
    }

    return { title, summary, hints: hints.slice(0, 5), culprit };
  }
}

module.exports = new CrashAnalyzer();
