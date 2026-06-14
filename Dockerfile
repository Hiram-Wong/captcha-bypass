FROM oven/bun AS build

WORKDIR /app
COPY . /app
RUN cp /app/.env.example /app/.env && \
    rm -rf /app/.env.example

RUN bun install
ARG TARGETARCH
RUN ARCH=$( [ "$TARGETARCH" = "arm64" ] && echo arm64 || echo x64 ) && \
    bun scripts/build.js --platform linux --arch $ARCH && \
	mv /app/dist/captcha-bypass-linux-${ARCH} /app/dist/captcha-bypass

FROM gcr.io/distroless/cc-debian12 AS runtime

WORKDIR /app

COPY --from=build /app/dist/captcha-bypass .
COPY --from=build /app/dist/models ./models

EXPOSE 7788

CMD ["./captcha-bypass"]
