/**
 * Expo config plugin that adds the TurboModule crash guard file
 * to the iOS project after prebuild.
 */
const { withXcodeProject, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const CRASH_GUARD_CODE = `/**
 * Runtime patch for iOS 26 TurboModule SIGABRT crash (RN issue #54859).
 * Installs a C++ terminate handler that catches the rethrown exception
 * from ObjCTurboModule::performVoidMethodInvocation instead of SIGABRT.
 */
#import <Foundation/Foundation.h>
#include <exception>
#include <cstdlib>

static NSUncaughtExceptionHandler *previousHandler = nil;

static void turboModuleCrashGuardHandler(NSException *exception) {
    NSLog(@"[TurboModuleCrashGuard] Uncaught NSException: %@ - %@", exception.name, exception.reason);
    if (previousHandler) {
        previousHandler(exception);
    }
}

__attribute__((constructor))
static void installCrashGuard(void) {
    previousHandler = NSGetUncaughtExceptionHandler();
    NSSetUncaughtExceptionHandler(&turboModuleCrashGuardHandler);

    std::set_terminate([]() {
        NSLog(@"[TurboModuleCrashGuard] C++ terminate handler invoked");
        auto eptr = std::current_exception();
        if (eptr) {
            try {
                std::rethrow_exception(eptr);
            } catch (const std::exception &e) {
                NSLog(@"[TurboModuleCrashGuard] Caught: %s", e.what());
            } catch (...) {
                NSLog(@"[TurboModuleCrashGuard] Caught unknown C++ exception");
            }
        }
        _exit(0);
    });
}
`;

function withTurboModuleCrashGuard(config) {
  // Step 1: Write the .mm file to the project
  config = withDangerousMod(config, ['ios', (config) => {
    const projectDir = path.join(config.modRequest.platformProjectRoot, 'PBSim');
    const filePath = path.join(projectDir, 'TurboModuleCrashGuard.mm');
    fs.writeFileSync(filePath, CRASH_GUARD_CODE);
    return config;
  }]);

  // Step 2: Add it to the Xcode project
  config = withXcodeProject(config, (config) => {
    const project = config.modResults;
    const groupName = 'PBSim';

    // Find the main group
    const mainGroup = project.getFirstProject().firstProject.mainGroup;

    // Add the file to the project
    project.addSourceFile('PBSim/TurboModuleCrashGuard.mm', null, project.findPBXGroupKey({ name: groupName }));

    return config;
  });

  return config;
}

module.exports = withTurboModuleCrashGuard;
