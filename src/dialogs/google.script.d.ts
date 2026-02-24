declare namespace google {
  namespace script {
    interface Runner {
      applyOneStep(): void;
      finishInit(): void;
      getPuzzleJsonFromCache(): void;
      getRevertState(): void;
      initGridSetup(puzzleJson: string): void;
      needsGridSetup(): void;
      revertOperation(targetSlideCount: number, savedNotes: string): void;
      submitEnterCommand(input: string): void;
      withFailureHandler(handler: (error: Error) => void): Runner;
      withSuccessHandler<T>(handler: (result: T) => void): Runner;
    }
    const run: Runner;
    namespace host {
      function close(): void;
    }
  }
}
