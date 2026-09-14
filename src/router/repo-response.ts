export function missingRepositoryResponse(fullName: string) {
  return {
    statusCode: 404,
    body: {
      status: "error",
      message:
        `Repository '${fullName}' is not registered. Install the Pull GitHub App on this repository before checking its configuration.`,
    },
  } as const;
}
