FROM oven/bun AS build

WORKDIR /app
COPY . /app
RUN cp /app/.env.example /app/.env && \
    rm -rf /app/.env.example

RUN bun install
ARG TARGETARCH
RUN ARCH=$( [ "$TARGETARCH" = "arm64" ] && echo arm64 || echo x64 ) && \
    bun scripts/build.js --platform linux --arch $ARCH && \
    mv /app/dist/captcha-bypass-server-* /app/dist/captcha-bypass-server && \
    mv /app/dist/captcha-bypass-cli-* /app/dist/captcha-bypass-cli

FROM gcr.io/distroless/cc-debian12 AS runtime

WORKDIR /app

COPY --from=build /app/dist/captcha-bypass-* .
COPY --from=build /app/dist/models ./models
COPY --from=build /app/dist/public ./public

EXPOSE 7788

CMD ["./captcha-bypass-server"]
