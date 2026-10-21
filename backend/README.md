# Backend conventions

## Response contract

Every successful endpoint returns:

```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": {}
}
```

Every failed endpoint returns:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Please provide a valid email address",
      "code": "invalid_string"
    }
  ]
}
```

`errors` is included only when structured error details are available.

## Shared backend layers

- `constants/`: HTTP statuses, API messages, pagination defaults, user roles/statuses, and validation messages.
- `errors/ApiError.js`: operational errors passed to the global error handler.
- `middleware/`: authentication, authorization, validation, rate limiting, request logging, 404 handling, and global error handling.
- `utils/apiResponse.js`: the only place that constructs success/error JSON envelopes.
- `utils/asyncHandler.js`: forwards rejected controller promises to the global error handler.
- `utils/pagination.js`: common pagination parsing and metadata.
- `serializers/`: converts database documents into public API representations.

## Controller rules

1. Use `sendSuccess` for successful responses.
2. Throw `ApiError` for expected failures.
3. Use named values from `HTTP_STATUS` and `API_MESSAGES`; do not repeat numeric statuses or shared messages.
4. Wrap asynchronous handlers with `asyncHandler`.
5. Put returned resources inside `data`, including pagination metadata.
