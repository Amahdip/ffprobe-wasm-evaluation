/**
 * ffprobe-mini.c — Minimal metadata-only ffprobe for WASM
 *
 * Key difference from previous version: uses av_guess_sample_aspect_ratio()
 * instead of raw codecpar->sample_aspect_ratio, matching native ffprobe behavior.
 *
 * Build with Emscripten (see build.sh — FFmpeg 6.1.2):
 *   emcc ffprobe-mini.c -o ffprobe.js \
 *     -I<ffmpeg-wasm-prefix>/include \
 *     -L<ffmpeg-wasm-prefix>/lib \
 *     -lavformat -lavcodec -lavutil -lm \
 *     -s EXPORTED_FUNCTIONS='["_get_file_info_json","_free","_malloc"]' \
 *     -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","FS"]' \
 *     -s MODULARIZE=1 -s EXPORT_NAME="createFFprobe" \
 *     -s ALLOW_MEMORY_GROWTH=1 -s FORCE_FILESYSTEM=1 \
 *     -Oz
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>

#include <libavformat/avformat.h>
#include <libavcodec/avcodec.h>
#include <libavutil/avutil.h>
#include <libavutil/pixdesc.h>
#include <libavutil/dict.h>
#include <libavutil/rational.h>

/* ── helpers ─────────────────────────────────────────────────────── */

/* Append a string to a dynamically growing buffer */
typedef struct {
    char  *buf;
    size_t len;
    size_t cap;
    int    oom;
} DynBuf;

static const char OOM_JSON[] =
    "{\"ok\":false,\"error\":\"out of memory\"}";

static void db_init(DynBuf *db) {
    db->cap = 8192;
    db->oom = 0;
    db->buf = (char *)malloc(db->cap);
    if (!db->buf) {
        db->oom = 1;
        return;
    }
    db->buf[0] = '\0';
    db->len = 0;
}

static void db_append(DynBuf *db, const char *s) {
    if (db->oom || !db->buf)
        return;
    size_t slen = strlen(s);
    while (db->len + slen + 1 > db->cap) {
        size_t new_cap = db->cap * 2;
        char *new_buf = (char *)realloc(db->buf, new_cap);
        if (!new_buf) {
            free(db->buf);
            db->buf = NULL;
            db->oom = 1;
            return;
        }
        db->buf = new_buf;
        db->cap = new_cap;
    }
    memcpy(db->buf + db->len, s, slen + 1);
    db->len += slen;
}

static void db_printf(DynBuf *db, const char *fmt, ...) {
    if (db->oom)
        return;
    char tmp[1024];
    va_list ap;
    va_start(ap, fmt);
    vsnprintf(tmp, sizeof(tmp), fmt, ap);
    va_end(ap);
    db_append(db, tmp);
}

/* JSON-escape a string (minimal — handles \, ", control chars) */
static void db_append_json_str(DynBuf *db, const char *s) {
    db_append(db, "\"");
    if (s) {
        for (; *s; s++) {
            switch (*s) {
            case '"':  db_append(db, "\\\""); break;
            case '\\': db_append(db, "\\\\"); break;
            case '\n': db_append(db, "\\n");  break;
            case '\r': db_append(db, "\\r");  break;
            case '\t': db_append(db, "\\t");  break;
            default:
                if ((unsigned char)*s < 0x20) {
                    char esc[8];
                    snprintf(esc, sizeof(esc), "\\u%04x", (unsigned char)*s);
                    db_append(db, esc);
                } else {
                    char c[2] = { *s, '\0' };
                    db_append(db, c);
                }
            }
        }
    }
    db_append(db, "\"");
}

/* Color range name (matches ffprobe output) */
static const char *color_range_name(enum AVColorRange cr) {
    switch (cr) {
    case AVCOL_RANGE_MPEG:       return "tv";
    case AVCOL_RANGE_JPEG:       return "pc";
    default:                     return "unknown";
    }
}

/* Check if a transfer characteristic is HDR */
static int is_hdr_transfer(enum AVColorTransferCharacteristic trc) {
    return trc == AVCOL_TRC_SMPTE2084 ||   /* PQ / HDR10 */
           trc == AVCOL_TRC_ARIB_STD_B67;  /* HLG */
}

/* ── tags helper ─────────────────────────────────────────────────── */

static void emit_tags(DynBuf *db, const AVDictionary *tags) {
    if (!tags) {
        db_append(db, "null");
        return;
    }
    db_append(db, "{");
    const AVDictionaryEntry *e = NULL;
    int first = 1;
    while ((e = av_dict_get(tags, "", e, AV_DICT_IGNORE_SUFFIX))) {
        if (!first) db_append(db, ",");
        first = 0;
        db_append_json_str(db, e->key);
        db_append(db, ":");
        db_append_json_str(db, e->value);
    }
    db_append(db, "}");
}

/* ── packet walk (PoC: content-aware bitrate) ─────────────────────────
 *
 * walk_video_packets() demuxes the best video stream WITHOUT decoding and
 * returns a flat, malloc'd double buffer the JS side reads via HEAPF64:
 *
 *   out[0]               = packet count N (as double)
 *   out[1 + 3*i + 0]     = pts_time in seconds, offset so the first packet = 0
 *   out[1 + 3*i + 1]     = packet size in bytes
 *   out[1 + 3*i + 2]     = 1.0 if keyframe (AV_PKT_FLAG_KEY / IDR) else 0.0
 *
 * Caller MUST Module._free() the returned pointer. Returns NULL on error
 * (open failed / no video stream). No decoder is used, so this works for
 * every demuxer enabled in build.sh regardless of codec support.
 *
 * This is the server-side `ffprobe -select_streams v:0 -show_packets
 * -show_entries packet=pts_time,size,flags` reduced to the three fields the
 * bitrate math needs, packed binary instead of text so a multi-hour file's
 * packet table never becomes a giant JSON string in WASM memory.
 */
double *walk_video_packets(const char *filename) {
    AVFormatContext *fmt_ctx = NULL;
    if (avformat_open_input(&fmt_ctx, filename, NULL, NULL) < 0)
        return NULL;
    if (avformat_find_stream_info(fmt_ctx, NULL) < 0) {
        avformat_close_input(&fmt_ctx);
        return NULL;
    }

    int vstream = av_find_best_stream(fmt_ctx, AVMEDIA_TYPE_VIDEO, -1, -1, NULL, 0);
    if (vstream < 0) {
        avformat_close_input(&fmt_ctx);
        return NULL;
    }

    double tbd = av_q2d(fmt_ctx->streams[vstream]->time_base);

    size_t cap = 4096;   /* capacity in doubles */
    size_t len = 1;      /* index 0 reserved for the packet count */
    double *buf = (double *)malloc(cap * sizeof(double));
    if (!buf) {
        avformat_close_input(&fmt_ctx);
        return NULL;
    }

    AVPacket *pkt = av_packet_alloc();
    if (!pkt) {
        free(buf);
        avformat_close_input(&fmt_ctx);
        return NULL;
    }

    long long n = 0;
    int have_t0 = 0;
    double t0 = 0.0;

    while (av_read_frame(fmt_ctx, pkt) >= 0) {
        if (pkt->stream_index == vstream) {
            int64_t ts = (pkt->pts != AV_NOPTS_VALUE) ? pkt->pts : pkt->dts;
            double pts_s = (ts != AV_NOPTS_VALUE) ? (double)ts * tbd : 0.0;
            if (!have_t0) { t0 = pts_s; have_t0 = 1; }
            double rel = pts_s - t0;
            if (rel < 0) rel = 0;

            if (len + 3 > cap) {
                cap *= 2;
                double *nb = (double *)realloc(buf, cap * sizeof(double));
                if (!nb) {
                    free(buf);
                    av_packet_unref(pkt);
                    av_packet_free(&pkt);
                    avformat_close_input(&fmt_ctx);
                    return NULL;
                }
                buf = nb;
            }
            buf[len++] = rel;
            buf[len++] = (double)pkt->size;
            buf[len++] = (pkt->flags & AV_PKT_FLAG_KEY) ? 1.0 : 0.0;
            n++;
        }
        av_packet_unref(pkt);
    }

    av_packet_free(&pkt);
    avformat_close_input(&fmt_ctx);

    buf[0] = (double)n;
    return buf;
}

/* ── main probe function ──────────────────────────────────────────── */

char *get_file_info_json(const char *filename) {
    DynBuf db;
    db_init(&db);
    if (db.oom)
        return strdup(OOM_JSON);

    AVFormatContext *fmt_ctx = NULL;
    int ret;

    ret = avformat_open_input(&fmt_ctx, filename, NULL, NULL);
    if (ret < 0) {
        char errbuf[256];
        av_strerror(ret, errbuf, sizeof(errbuf));
        db_printf(&db,
            "{\"ok\":false,\"error\":\"avformat_open_input failed\","
            "\"error_detail\":\"%s\"}", errbuf);
        return db.buf;
    }

    ret = avformat_find_stream_info(fmt_ctx, NULL);
    int stream_info_ok = (ret >= 0);

    if (!stream_info_ok) {
        /* Still try to output what we can */
    }

    /* ── count stream types ─── */
    int video_count = 0, audio_count = 0, subtitle_count = 0, data_count = 0;
    for (unsigned i = 0; i < fmt_ctx->nb_streams; i++) {
        switch (fmt_ctx->streams[i]->codecpar->codec_type) {
        case AVMEDIA_TYPE_VIDEO:    video_count++;    break;
        case AVMEDIA_TYPE_AUDIO:    audio_count++;    break;
        case AVMEDIA_TYPE_SUBTITLE: subtitle_count++; break;
        default:                    data_count++;     break;
        }
    }

    /* ── begin JSON ─── */
    db_append(&db, "{");
    db_append(&db, "\"ok\":true");
    db_printf(&db, ",\"stream_info_ok\":%s", stream_info_ok ? "true" : "false");

    /* format info */
    if (fmt_ctx->iformat && fmt_ctx->iformat->name) {
        db_append(&db, ",\"format_name\":");
        db_append_json_str(&db, fmt_ctx->iformat->name);
    } else {
        db_append(&db, ",\"format_name\":null");
    }

    db_append(&db, ",\"format_long_name\":null");

    /* duration */
    if (fmt_ctx->duration != AV_NOPTS_VALUE) {
        double dur = (double)fmt_ctx->duration / AV_TIME_BASE;
        db_printf(&db, ",\"duration\":%.4g", dur);
    } else {
        db_append(&db, ",\"duration\":null");
    }

    /* bit rate */
    if (fmt_ctx->bit_rate > 0) {
        db_printf(&db, ",\"bit_rate\":%lld", (long long)fmt_ctx->bit_rate);
    } else {
        db_append(&db, ",\"bit_rate\":null");
    }

    db_printf(&db, ",\"nb_streams\":%u", fmt_ctx->nb_streams);
    db_printf(&db, ",\"probe_score\":%d", fmt_ctx->probe_score);

    /* ── streams ─── */
    db_append(&db, ",\"streams\":[");
    for (unsigned i = 0; i < fmt_ctx->nb_streams; i++) {
        AVStream *st = fmt_ctx->streams[i];
        AVCodecParameters *par = st->codecpar;

        if (i > 0) db_append(&db, ",");
        db_append(&db, "{");

        db_printf(&db, "\"index\":%u", i);
        db_printf(&db, ",\"id\":%d", st->id);

        /* codec_type */
        const char *type_str;
        switch (par->codec_type) {
        case AVMEDIA_TYPE_VIDEO:    type_str = "video";    break;
        case AVMEDIA_TYPE_AUDIO:    type_str = "audio";    break;
        case AVMEDIA_TYPE_SUBTITLE: type_str = "subtitle"; break;
        default:                    type_str = "data";     break;
        }
        db_printf(&db, ",\"codec_type\":\"%s\"", type_str);

        /* codec name */
        const char *codec_name = avcodec_get_name(par->codec_id);
        if (codec_name) {
            db_append(&db, ",\"codec_name\":");
            db_append_json_str(&db, codec_name);
        } else {
            db_append(&db, ",\"codec_name\":null");
        }

        db_printf(&db, ",\"codec_id\":%d", (int)par->codec_id);

        /* codec_tag_string */
        char tag_str[AV_FOURCC_MAX_STRING_SIZE];
        av_fourcc_make_string(tag_str, par->codec_tag);
        db_append(&db, ",\"codec_tag_string\":");
        db_append_json_str(&db, tag_str);

        /* profile (FF_PROFILE_UNKNOWN matches FFmpeg 6.1.x in build.sh) */
        if (par->profile != FF_PROFILE_UNKNOWN) {
            const char *profile_name = avcodec_profile_name(par->codec_id, par->profile);
            if (profile_name) {
                db_append(&db, ",\"profile\":");
                db_append_json_str(&db, profile_name);
            } else {
                db_append(&db, ",\"profile\":null");
            }
        } else {
            db_append(&db, ",\"profile\":null");
        }

        db_printf(&db, ",\"level\":%d", par->level);

        if (par->codec_type == AVMEDIA_TYPE_VIDEO) {
            /* dimensions */
            db_printf(&db, ",\"width\":%d", par->width);
            db_printf(&db, ",\"height\":%d", par->height);
            db_printf(&db, ",\"codec_width\":%d", par->width);
            db_printf(&db, ",\"codec_height\":%d", par->height);

            /* pixel format */
            const char *pix_name = av_get_pix_fmt_name(par->format);
            if (pix_name) {
                db_append(&db, ",\"pix_fmt\":");
                db_append_json_str(&db, pix_name);
            } else {
                db_append(&db, ",\"pix_fmt\":null");
            }

            /* frame rates */
            db_printf(&db, ",\"avg_frame_rate\":\"%d/%d\"",
                      st->avg_frame_rate.num, st->avg_frame_rate.den);
            db_printf(&db, ",\"r_frame_rate\":\"%d/%d\"",
                      st->r_frame_rate.num, st->r_frame_rate.den);

            /* computed fps */
            if (st->avg_frame_rate.den > 0 && st->avg_frame_rate.num > 0) {
                double fps = av_q2d(st->avg_frame_rate);
                db_printf(&db, ",\"fps\":%.4g", fps);
            } else if (st->r_frame_rate.den > 0 && st->r_frame_rate.num > 0) {
                double fps = av_q2d(st->r_frame_rate);
                db_printf(&db, ",\"fps\":%.4g", fps);
            } else {
                db_append(&db, ",\"fps\":null");
            }

            /*
             * *** THE KEY FIX ***
             * Use av_guess_sample_aspect_ratio() — same as native ffprobe.
             * This converts {0,1} (unspecified) into {1,1} (square pixels).
             */
            AVRational sar = av_guess_sample_aspect_ratio(fmt_ctx, st, NULL);
            if (sar.num > 0 && sar.den > 0) {
                db_printf(&db, ",\"sample_aspect_ratio\":\"%d/%d\"",
                          sar.num, sar.den);

                /* Compute display_aspect_ratio = width*sar / height */
                AVRational dar;
                av_reduce(&dar.num, &dar.den,
                          (int64_t)par->width  * sar.num,
                          (int64_t)par->height * sar.den,
                          1024 * 1024);
                db_printf(&db, ",\"display_aspect_ratio\":\"%d/%d\"",
                          dar.num, dar.den);
            } else {
                db_append(&db, ",\"sample_aspect_ratio\":null");
                db_append(&db, ",\"display_aspect_ratio\":null");
            }

            /* rotation — check side data and tags */
            int rotation_val = 0;
            int has_rotation = 0;
            /* Check stream metadata for rotate tag */
            const AVDictionaryEntry *rot_tag = av_dict_get(st->metadata, "rotate", NULL, 0);
            if (rot_tag && rot_tag->value) {
                rotation_val = atoi(rot_tag->value);
                has_rotation = 1;
            }
            if (has_rotation) {
                db_printf(&db, ",\"rotation\":%d", rotation_val);
            } else {
                db_append(&db, ",\"rotation\":null");
            }

            /* color properties */
            db_printf(&db, ",\"color_range\":\"%s\"",
                      color_range_name(par->color_range));

            const char *cp_name = av_color_primaries_name(par->color_primaries);
            db_printf(&db, ",\"color_primaries\":\"%s\"",
                      cp_name ? cp_name : "unknown");

            const char *ct_name = av_color_transfer_name(par->color_trc);
            db_printf(&db, ",\"color_transfer\":\"%s\"",
                      ct_name ? ct_name : "unknown");

            const char *cs_name = av_color_space_name(par->color_space);
            db_printf(&db, ",\"color_space\":\"%s\"",
                      cs_name ? cs_name : "unknown");

            /* HDR detection */
            db_printf(&db, ",\"is_hdr\":%s",
                      is_hdr_transfer(par->color_trc) ? "true" : "false");

            /* field_order */
            db_printf(&db, ",\"field_order\":%d", (int)par->field_order);

        } else if (par->codec_type == AVMEDIA_TYPE_AUDIO) {
            /* audio-specific fields */
            db_printf(&db, ",\"channels\":%d",
                      par->ch_layout.nb_channels);
            db_printf(&db, ",\"sample_rate\":%d", par->sample_rate);

            db_printf(&db, ",\"frame_size\":%d", par->frame_size);

            const char *sf_name = av_get_sample_fmt_name(par->format);
            if (sf_name) {
                db_append(&db, ",\"sample_fmt\":");
                db_append_json_str(&db, sf_name);
            } else {
                db_append(&db, ",\"sample_fmt\":null");
            }
        }

        /* bit_rate (all streams) */
        if (par->bit_rate > 0) {
            db_printf(&db, ",\"bit_rate\":%lld", (long long)par->bit_rate);
        } else {
            /* Try to estimate from format bitrate for the primary stream */
            db_append(&db, ",\"bit_rate\":0");
        }

        /* time_base */
        db_printf(&db, ",\"time_base\":\"%d/%d\"",
                  st->time_base.num, st->time_base.den);

        /* stream duration */
        if (st->duration != AV_NOPTS_VALUE && st->time_base.den > 0) {
            double dur = (double)st->duration * av_q2d(st->time_base);
            db_printf(&db, ",\"duration\":%.4g", dur);
        } else if (fmt_ctx->duration != AV_NOPTS_VALUE) {
            double dur = (double)fmt_ctx->duration / AV_TIME_BASE;
            db_printf(&db, ",\"duration\":%.4g", dur);
        } else {
            db_append(&db, ",\"duration\":null");
        }

        /* nb_frames */
        db_printf(&db, ",\"nb_frames\":%lld", (long long)st->nb_frames);

        /* tags */
        db_append(&db, ",\"tags\":");
        emit_tags(&db, st->metadata);

        db_append(&db, "}");  /* end stream */
    }
    db_append(&db, "]");  /* end streams array */

    /* ── stream counts ─── */
    db_printf(&db, ",\"has_video\":%s",    video_count    > 0 ? "true" : "false");
    db_printf(&db, ",\"has_audio\":%s",    audio_count    > 0 ? "true" : "false");
    db_printf(&db, ",\"video_stream_count\":%d",    video_count);
    db_printf(&db, ",\"audio_stream_count\":%d",    audio_count);
    db_printf(&db, ",\"subtitle_stream_count\":%d", subtitle_count);
    db_printf(&db, ",\"data_stream_count\":%d",     data_count);

    /* ── format tags ─── */
    db_append(&db, ",\"tags\":");
    emit_tags(&db, fmt_ctx->metadata);

    /* ── library versions ─── */
    db_printf(&db, ",\"versions\":{\"libavformat\":\"%d\",\"libavcodec\":\"%d\",\"libavutil\":\"%d\"}",
              LIBAVFORMAT_VERSION_MAJOR,
              LIBAVCODEC_VERSION_MAJOR,
              LIBAVUTIL_VERSION_MAJOR);

    db_append(&db, "}");  /* end root object */

    avformat_close_input(&fmt_ctx);

    if (db.oom) {
        free(db.buf);
        return strdup(OOM_JSON);
    }

    return db.buf;
}
